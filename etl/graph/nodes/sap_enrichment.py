"""SAP supplier e-mail enrichment node (SRM → PO history → vendor master cascade)."""

from __future__ import annotations

import asyncio
import logging
import re
from typing import Any

from etl.dpp_flash.services.sap_enrichment import resolve_supplier_email
from etl.graph.coerce_state import coerce_extracted_data, coerce_gaps, coerce_sku_master_data
from etl.graph.state import DppGraphState, EnrichmentAttemptResult, EnrichmentStage
from etl.models.audit_field import AuditField, audit_text
from etl.services.contact_scorer import ContactScorer
from etl.services.enrichment import apply_supplier_contact_to_dpp
from etl.services.outreach_recipient import resolve_bom_contact_from_sap_export
from etl.services.sap_product_odata_ingest import coerce_sap_product_payload

logger = logging.getLogger(__name__)


async def sap_enrichment_node(state: DppGraphState) -> dict[str, Any]:
    """
    Resolve supplier e-mail via SAP cascade before supplier outreach.

    When ``sap_export`` contains S/4 ``A_Product`` OData, contacts are taken
    **only** from BOM supplier details in that JSON (no mock cascade).

    Flat ``supplier_odata`` uses ``ContactScorer`` when no product export is present.
    """
    product_id = _resolve_product_id(state)
    supplier_id = _resolve_supplier_id(state)

    try:
        sap_export = state.get("sap_export")
        if coerce_sap_product_payload(sap_export) is not None:
            block, scored = await asyncio.to_thread(
                resolve_bom_contact_from_sap_export,
                sap_export if isinstance(sap_export, dict) else None,
            )
            if scored is not None:
                logger.info(
                    "sap_enrichment_node: A_Product JSON contact product_id=%s email=%s",
                    product_id,
                    audit_text(scored),
                )
                if block is not None:
                    metadata = dict(state.get("metadata") or {})
                    metadata.update(
                        {
                            "supplier_id": block.supplier_id,
                            "supplier_name": block.supplier_name,
                            "bom_component": block.component_description,
                        }
                    )
                    state = {**state, "metadata": metadata}
                return _build_success_update(state, scored)

            logger.warning(
                "sap_enrichment_node: A_Product JSON has no acceptable contact — HITL "
                "product_id=%s",
                product_id,
            )
            return {
                "supplier_email": None,
                "email_source": None,
                "email_found": False,
                "enrichment_stage": EnrichmentStage.SAP_EMAIL_LOOKUP,
                "errors": [
                    "sap_enrichment_node: no acceptable contact in SAP A_Product JSON "
                    "(blacklist or empty) — buyer intervention required.",
                ],
            }

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
                return _build_success_update(state, scored)

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
            return _build_success_update(state, lookup.email)

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


def _build_success_update(state: DppGraphState, supplier_email: AuditField) -> dict[str, Any]:
    update: dict[str, Any] = {
        "supplier_email": supplier_email,
        "email_source": supplier_email.source_system,
        "email_found": True,
        "enrichment_stage": EnrichmentStage.SAP_EMAIL_LOOKUP,
    }

    metadata = state.get("metadata")
    if isinstance(metadata, dict) and metadata:
        update["metadata"] = metadata

    extracted_data = coerce_extracted_data(state.get("extracted_data"))
    gaps = coerce_gaps(state.get("gaps"))
    if extracted_data is None:
        return update

    filled_paths, remaining_gaps = apply_supplier_contact_to_dpp(
        extracted_data,
        _enrich_contact_provenance(supplier_email, state),
        gaps,
    )
    if filled_paths:
        update["extracted_data"] = extracted_data
        update["gaps"] = remaining_gaps
        update["enrichment_result"] = EnrichmentAttemptResult(
            stage=EnrichmentStage.SAP_EMAIL_LOOKUP,
            success=True,
            filled_field_paths=filled_paths,
            remaining_gaps=remaining_gaps,
            notes=(
                f"SAP contact applied to DPP: {audit_text(supplier_email)} "
                f"({supplier_email.source_detail or 'no detail'})"
            ),
        )

    return update


def _enrich_contact_provenance(supplier_email: AuditField, state: DppGraphState) -> AuditField:
    metadata = state.get("metadata") or {}
    supplier_name = metadata.get("supplier_name")
    bom_component = metadata.get("bom_component")
    if not supplier_name and not bom_component:
        return supplier_email

    context = " / ".join(part for part in (supplier_name, bom_component) if isinstance(part, str) and part.strip())
    if not context:
        return supplier_email

    existing = supplier_email.source_detail or ""
    if context in existing:
        return supplier_email

    return supplier_email.model_copy(
        update={"source_detail": f"{context} · {existing}".strip(" ·")},
    )


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

    master = coerce_sku_master_data(state.get("sku_master_data"))
    if master and master.manufacturer_name:
        slug = re.sub(r"[^a-z0-9]+", "-", master.manufacturer_name.lower()).strip("-")
        if slug:
            return slug

    return f"UNKNOWN-{_resolve_product_id(state)}"
