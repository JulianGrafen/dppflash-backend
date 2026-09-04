"""Supplier outreach node."""

from __future__ import annotations

from typing import Any

from etl.graph.coerce_state import coerce_extracted_data, coerce_gaps, coerce_sku_master_data
from etl.models.audit_field import AuditField, audit_text
from etl.graph.state import DppGraphState, EnrichmentStage
from etl.services.enrichment import send_supplier_outreach


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

    supplier_email = state.get("supplier_email")
    if supplier_email is not None and not isinstance(supplier_email, AuditField):
        supplier_email = None

    result = send_supplier_outreach(
        extracted_data=extracted_data,
        gaps=gaps,
        product_identifier=_resolve_product_identifier(state),
        supplier_email=supplier_email,
    )

    return {
        "enrichment_stage": EnrichmentStage.SUPPLIER_OUTREACH,
        "enrichment_result": result,
        "gaps": result.remaining_gaps,
        "extracted_data": extracted_data,
    }
