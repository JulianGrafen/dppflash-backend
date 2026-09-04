"""SAP supplier e-mail enrichment node (SRM → PO history → vendor master cascade)."""

from __future__ import annotations

import asyncio
import logging
import re
from typing import Any

from etl.dpp_flash.services.sap_enrichment import resolve_supplier_email
from etl.graph.coerce_state import coerce_extracted_data, coerce_sku_master_data
from etl.graph.state import DppGraphState, EnrichmentStage
from etl.models.audit_field import audit_text
from etl.services.contact_scorer import ContactScorer

logger = logging.getLogger(__name__)


async def sap_enrichment_node(state: DppGraphState) -> dict[str, Any]:
    """
    Resolve supplier e-mail via SAP cascade before supplier outreach.

    When ``supplier_odata`` is present, ``ContactScorer`` runs first. A miss
    (blacklist / no usable address) escalates to HITL without falling through
    to the mock cascade. Without OData, mock SRM → PO → vendor lookups apply.
    """
    product_id = _resolve_product_id(state)
    supplier_id = _resolve_supplier_id(state)

    try:
        supplier_odata = state.get("supplier_odata")
        if isinstance(supplier_odata, dict):
            scored = await asyncio.to_thread(
                ContactScorer().get_best_contact,
                supplier_odata,
            )
            if scored is not None:
                logger.info(
                    "sap_enrichment_node: ContactScorer hit product_id=%s source=%s",
                    product_id,
                    scored.source_detail,
                )
                return {
                    "supplier_email": scored,
                    "email_source": scored.source_system,
                    "email_found": True,
                    "enrichment_stage": EnrichmentStage.SAP_EMAIL_LOOKUP,
                }

            logger.warning(
                "sap_enrichment_node: ContactScorer rejected OData contacts — HITL "
                "product_id=%s supplier_id=%s",
                product_id,
                supplier_id,
            )
            return {
                "supplier_email": None,
                "email_source": None,
                "email_found": False,
                "enrichment_stage": EnrichmentStage.SAP_EMAIL_LOOKUP,
                "errors": [
                    "sap_enrichment_node: ContactScorer found no acceptable e-mail "
                    "(blacklist or empty) — buyer intervention required.",
                ],
            }

        lookup = await asyncio.to_thread(
            resolve_supplier_email,
            product_id=product_id,
            supplier_id=supplier_id,
        )

        if lookup is not None:
            logger.info(
                "sap_enrichment_node: product_id=%s supplier_id=%s source=%s",
                product_id,
                supplier_id,
                lookup.email.source_system,
            )
            return {
                "supplier_email": lookup.email,
                "email_source": lookup.email.source_system,
                "email_found": True,
                "enrichment_stage": EnrichmentStage.SAP_EMAIL_LOOKUP,
            }

        logger.warning(
            "sap_enrichment_node: no e-mail — escalate product_id=%s supplier_id=%s",
            product_id,
            supplier_id,
        )
        return {
            "supplier_email": None,
            "email_source": None,
            "email_found": False,
            "enrichment_stage": EnrichmentStage.SAP_EMAIL_LOOKUP,
            "errors": [
                "sap_enrichment_node: all SAP lookup steps failed — buyer intervention required.",
            ],
        }
    except Exception as exc:  # noqa: BLE001 — node must never crash the graph
        logger.exception("sap_enrichment_node failed")
        return {
            "supplier_email": None,
            "email_source": None,
            "email_found": False,
            "enrichment_stage": EnrichmentStage.SAP_EMAIL_LOOKUP,
            "errors": [f"sap_enrichment_node: {exc}"],
        }


def _resolve_product_id(state: DppGraphState) -> str:
    master = coerce_sku_master_data(state.get("sku_master_data"))
    if master and master.sku and master.sku.strip():
        return master.sku.strip()

    extracted = coerce_extracted_data(state.get("extracted_data"))
    if extracted and extracted.identification:
        for field in (
            extracted.identification.unique_product_identifier,
            extracted.identification.gtin_or_equivalent,
        ):
            text = audit_text(field)
            if text:
                return text

    return "unknown"


def _resolve_supplier_id(state: DppGraphState) -> str:
    metadata = state.get("metadata") or {}
    for key in ("supplier_id", "vendor_id", "lifnr"):
        value = metadata.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()

    extracted = coerce_extracted_data(state.get("extracted_data"))
    if extracted and extracted.economic_operator:
        operator_id = audit_text(extracted.economic_operator.unique_operator_identifier)
        if operator_id:
            return operator_id

        manufacturer = audit_text(extracted.economic_operator.manufacturer_name)
        if manufacturer:
            slug = re.sub(r"[^a-z0-9]+", "-", manufacturer.lower()).strip("-")
            if slug:
                return slug

    return f"UNKNOWN-{_resolve_product_id(state)}"
