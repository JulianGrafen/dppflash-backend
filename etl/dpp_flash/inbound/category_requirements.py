"""Delegated-act field requirements for inbound ProductPassportDraft (extensible registry)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

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


def validate_universal_draft_fields(draft: Any) -> None:
    """After Stammdaten merge: universal ESPR anchor fields must be present."""
    if not _is_filled(getattr(draft, "upi", None)):
        raise ValueError("upi ist zwingend erforderlich.")
    if getattr(draft, "category", None) is None:
        raise ValueError("category ist zwingend erforderlich.")
    if not _is_filled(effective_manufacturer_name(draft)):
        raise ValueError("manufacturer_name ist zwingend erforderlich.")
    if not _is_filled(getattr(draft, "taric_code", None)):
        raise ValueError("taric_code ist zwingend erforderlich.")
