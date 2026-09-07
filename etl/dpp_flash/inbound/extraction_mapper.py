"""Map LangGraph/OpenAI extraction results to inbound ProductPassportDraft."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from etl.dpp_flash.inbound.models import ProductPassportDraft
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

    manufacturer_address = None
    if result.economic_operator is not None:
        manufacturer_address = _audit_value(result.economic_operator.manufacturer_name)

    weight = None
    if result.product_details is not None:
        weight = _audit_value(result.product_details.product_weight)

    safety_warnings: list[str] = []

    return ProductPassportDraft(
        upi=upi,
        gtin=gtin,
        weight=weight,
        manufacturer_address=manufacturer_address,
        safety_warnings=safety_warnings,
        is_draft=True,
    )
