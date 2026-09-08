"""Map LangGraph/OpenAI extraction results to inbound ProductPassportDraft."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from etl.dpp_flash.inbound.models import Contact, ProductPassportDraft
from etl.models.dpp_schemas import DPPAnalysisResult


def _audit_value(field: Any) -> str | None:
    """Extract string value from an AuditField wrapper, if present."""
    if field is None:
        return None
    value = getattr(field, "value", None)
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def analysis_result_to_passport_draft(
    result: DPPAnalysisResult,
    filename: str,
) -> ProductPassportDraft:
    """Best-effort mapping from full extraction to the flat inbound draft schema."""
    upi = _audit_value(
        result.identification.unique_product_identifier if result.identification else None
    )
    if not upi:
        upi = f"PDF-{Path(filename).stem}"[:120]

    gtin = _audit_value(
        result.identification.gtin_or_equivalent if result.identification else None
    )

    hersteller = None
    herstelleradresse = None
    eori = None
    kontakt = None
    if result.economic_operator is not None:
        hersteller = _audit_value(result.economic_operator.manufacturer_name)
        herstelleradresse = _audit_value(result.economic_operator.manufacturer_address)
        eori = _audit_value(result.economic_operator.unique_operator_identifier)
        contact_text = _audit_value(result.economic_operator.electronic_contact_details)
        if contact_text:
            kontakt = Contact(name=contact_text)

    weight = None
    if result.product_details is not None:
        weight = _audit_value(result.product_details.product_weight)

    safety_warnings: list[str] = []

    return ProductPassportDraft(
        upi=upi,
        gtin=gtin,
        weight=weight,
        hersteller=hersteller,
        herstelleradresse=herstelleradresse,
        kontakt=kontakt,
        eori=eori,
        safety_warnings=safety_warnings,
        is_draft=True,
    )
