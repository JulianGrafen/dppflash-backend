"""Supplier outreach node."""

from __future__ import annotations

from typing import Any

from etl.graph.coerce_state import coerce_extracted_data, coerce_gaps, coerce_sku_master_data
from etl.graph.state import DppGraphState, EnrichmentStage
from etl.models.audit_field import audit_text
from etl.services.enrichment import send_supplier_outreach
from etl.services.outreach_recipient import resolve_outreach_recipient_from_json


def _resolve_product_identifier(state: DppGraphState) -> str | None:
    extracted = coerce_extracted_data(state.get("extracted_data"))
    if extracted and extracted.identification:
        for field in (
            extracted.identification.unique_product_identifier,
            extracted.identification.gtin_or_equivalent,
        ):
            text = audit_text(field)
            if text:
                return text
    master = coerce_sku_master_data(state.get("sku_master_data"))
    if master and master.product_name:
        return master.product_name
    return None


async def supplier_outreach_node(state: DppGraphState) -> dict[str, Any]:
    extracted_data = coerce_extracted_data(state.get("extracted_data"))
    gaps = coerce_gaps(state.get("gaps"))

    if extracted_data is None:
        return {"errors": ["supplier_outreach_node: extracted_data is missing."]}

    sap_export = state.get("sap_export") if isinstance(state.get("sap_export"), dict) else None
    metadata = dict(state.get("metadata") or {})

    recipient = resolve_outreach_recipient_from_json(sap_export)
    if recipient is None:
        return {
            "enrichment_stage": EnrichmentStage.SUPPLIER_OUTREACH,
            "enrichment_result": None,
            "errors": [
                "supplier_outreach_node: keine Lieferanten-E-Mail im aktuellen sap_export JSON — "
                "Versand nur an to_ContactPerson / DefaultEmailAddress aus dem JSON.",
            ],
        }

    result = send_supplier_outreach(
        extracted_data=extracted_data,
        gaps=gaps,
        product_identifier=_resolve_product_identifier(state),
        sap_export=sap_export,
    )

    return {
        "enrichment_stage": EnrichmentStage.SUPPLIER_OUTREACH,
        "enrichment_result": result,
        "gaps": result.remaining_gaps,
        "extracted_data": extracted_data,
        "supplier_email": recipient,
        "email_found": True,
        "metadata": {
            **metadata,
            "last_supplier_outreach": result.notes,
            "outreach_recipient": audit_text(recipient),
        },
    }
