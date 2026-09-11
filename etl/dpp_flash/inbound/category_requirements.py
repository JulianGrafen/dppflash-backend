"""Delegated-act field requirements for inbound ProductPassportDraft (extensible registry)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from etl.graph.state import GapRecord
from etl.models.dpp_schemas import ProductCategory


@dataclass(frozen=True)
class CategoryFieldRule:
    field: str
    message: str


CATEGORY_REQUIRED_FIELDS: dict[ProductCategory, tuple[CategoryFieldRule, ...]] = {
    ProductCategory.ELECTRONICS: (
        CategoryFieldRule(
            "repairability_info",
            "Für Elektronik-Produkte ist repairability_info zwingend erforderlich.",
        ),
        CategoryFieldRule(
            "material_composition",
            "Für Elektronik-Produkte ist material_composition zwingend erforderlich.",
        ),
    ),
    ProductCategory.CHEMICALS: (
        CategoryFieldRule(
            "contains_svhc",
            "Für Chemie-Produkte ist contains_svhc zwingend erforderlich.",
        ),
    ),
}


def _is_filled(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, bool):
        return True
    if isinstance(value, str):
        return bool(value.strip())
    return True


def effective_manufacturer_name(draft: Any) -> str | None:
    """Resolve manufacturer from canonical or legacy ERP field."""
    name = getattr(draft, "manufacturer_name", None) or getattr(draft, "hersteller", None)
    if name is None:
        return None
    text = str(name).strip()
    return text or None


def validate_category_required_fields(draft: Any) -> None:
    """Raise ValueError when a category-specific mandatory draft field is missing."""
    category = getattr(draft, "category", ProductCategory.GENERIC)
    rules = CATEGORY_REQUIRED_FIELDS.get(category, ())
    for rule in rules:
        value = getattr(draft, rule.field, None)
        if not _is_filled(value):
            raise ValueError(rule.message)


def collect_universal_draft_gaps(draft: Any) -> list[GapRecord]:
    """After Stammdaten merge: report missing universal ESPR anchor fields."""
    gaps: list[GapRecord] = []
    if not _is_filled(getattr(draft, "upi", None)):
        gaps.append(
            GapRecord(
                field_path="upi",
                reason="upi ist zwingend erforderlich.",
                severity="major",
            )
        )
    if getattr(draft, "category", None) is None:
        gaps.append(
            GapRecord(
                field_path="category",
                reason="category ist zwingend erforderlich.",
                severity="major",
            )
        )
    if not _is_filled(effective_manufacturer_name(draft)):
        gaps.append(
            GapRecord(
                field_path="manufacturer_name",
                reason=(
                    "manufacturer_name ist zwingend erforderlich "
                    "(Produktzeile oder Tenant-Stammdaten)."
                ),
                severity="major",
            )
        )
    if not _is_filled(getattr(draft, "taric_code", None)):
        gaps.append(
            GapRecord(
                field_path="taric_code",
                reason=(
                    "taric_code ist zwingend erforderlich "
                    "(Produktzeile oder Tenant-Stammdaten)."
                ),
                severity="major",
            )
        )
    return gaps


def validate_universal_draft_fields(draft: Any) -> None:
    """Raise ValueError when universal anchor fields are missing (strict callers/tests)."""
    gaps = collect_universal_draft_gaps(draft)
    if gaps:
        raise ValueError(gaps[0].reason)
