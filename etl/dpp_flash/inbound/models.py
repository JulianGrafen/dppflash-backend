"""Pydantic V2 models for the ESPR product passport (inbound push schema).

Design notes
------------
Every non-mandatory field is declared ``Optional`` with a ``None`` default so the
master-fallback merge (:func:`etl.dpp_flash.inbound.fusion.deep_merge_dpp`) can
distinguish "explicitly empty" from "provided". Only ``upi`` is mandatory at KMU
import; category-specific and universal completeness are validated separately.
"""

from __future__ import annotations

import re
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from etl.dpp_flash.inbound.category_requirements import (
    validate_category_required_fields,
)
from etl.models.dpp_schemas import ProductCategory

# GTIN-8 / GTIN-12 (UPC) / GTIN-13 (EAN) / GTIN-14 — digits only.
_GTIN_PATTERN = re.compile(r"^\d{8}$|^\d{12,14}$")

_CATEGORY_ALIASES: dict[str, ProductCategory] = {
    "TEXTILES": ProductCategory.TEXTILES_APPAREL,
    "TEXTILE": ProductCategory.TEXTILES_APPAREL,
    "TEXTILES_APPAREL": ProductCategory.TEXTILES_APPAREL,
    "ELECTRONICS": ProductCategory.ELECTRONICS,
    "BATTERIES": ProductCategory.BATTERIES,
    "CHEMICALS": ProductCategory.CHEMICALS,
    "GENERIC": ProductCategory.GENERIC,
}


def _coerce_product_category(value: Any) -> ProductCategory:
    if isinstance(value, ProductCategory):
        return value
    if value is None or (isinstance(value, str) and not value.strip()):
        return ProductCategory.GENERIC
    key = str(value).strip().upper().replace("-", "_").replace(" ", "_")
    if key in _CATEGORY_ALIASES:
        return _CATEGORY_ALIASES[key]
    try:
        return ProductCategory(key)
    except ValueError:
        return ProductCategory.GENERIC


class Contact(BaseModel):
    """Supplier or manufacturer contact person."""

    model_config = ConfigDict(str_strip_whitespace=True)

    name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None


class BillOfMaterialItem(BaseModel):
    """One BOM line with optional compliance attributes (SVHC, CO2)."""

    model_config = ConfigDict(str_strip_whitespace=True)

    bom_number: str | None = None
    component_description: str | None = None
    supplier_contact: Contact | None = None
    svhc_status: str | None = None
    co2_footprint: str | None = None


class ProductPassportDraft(BaseModel):
    """ESPR product passport draft — the fusion target of SAP + SDS data.

    KMU import requires ``upi`` only; ``@model_validator`` enforces delegated-act
    fields per ``category``. Universal anchors (manufacturer, TARIC) are checked
    on persist via :func:`validate_universal_draft_fields`.
    """

    model_config = ConfigDict(str_strip_whitespace=True)

    category: ProductCategory = Field(
        default=ProductCategory.GENERIC,
        description="ESPR product category (Delegated Act scope).",
    )
    upi: str = Field(min_length=1, description="Unique Product Identifier (mandatory).")
    manufacturer_name: str | None = Field(
        default=None,
        description="Legal manufacturer name (ERP master or tenant Stammdaten).",
    )
    taric_code: str | None = Field(
        default=None,
        description="EU TARIC / HS commodity code.",
    )
    repairability_info: str | None = None
    recyclability_info: str | None = None
    contains_svhc: str | None = None
    material_composition: str | None = None

    gtin: str | None = Field(default=None, description="GTIN-8/12/13/14, digits only.")
    weight: str | None = None
    is_draft: bool = True
    hersteller: str | None = Field(
        default=None,
        description="Deprecated alias for manufacturer_name — kept for Excel exports.",
    )
    herstelleradresse: str | None = Field(
        default=None,
        description="Full manufacturer postal address (ERP master).",
    )
    kontakt: Contact | None = Field(default=None, description="Manufacturer contact person.")
    eori: str | None = Field(
        default=None,
        description="Economic operator registration (EORI) if known in ERP.",
    )
    manufacturer_address: str | None = Field(
        default=None,
        description="Deprecated alias for herstelleradresse — kept for backward compatibility.",
    )
    disposal_instructions: str | None = None
    safety_warnings: list[str] = Field(default_factory=list)
    bom: list[BillOfMaterialItem] = Field(default_factory=list)

    @field_validator("gtin")
    @classmethod
    def validate_gtin(cls, value: str | None) -> str | None:
        """Accept GTIN-8/12/13/14; normalize surrounding whitespace."""
        if value is None or value == "":
            return None
        normalized = value.strip()
        if not _GTIN_PATTERN.fullmatch(normalized):
            raise ValueError(
                "gtin must be 8, 12, 13 or 14 digits (GTIN-8/12/13/14), "
                f"got {normalized!r}"
            )
        return normalized

    @field_validator("category", mode="before")
    @classmethod
    def _normalize_category(cls, value: Any) -> ProductCategory:
        return _coerce_product_category(value)

    @model_validator(mode="before")
    @classmethod
    def _normalize_legacy_master_fields(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        payload = dict(data)
        legacy_address = payload.get("manufacturer_address")
        if legacy_address and not payload.get("herstelleradresse"):
            payload["herstelleradresse"] = legacy_address
        hersteller = payload.get("hersteller")
        if hersteller and not payload.get("manufacturer_name"):
            payload["manufacturer_name"] = hersteller
        return payload

    @model_validator(mode="after")
    def _enforce_category_requirements(self) -> ProductPassportDraft:
        validate_category_required_fields(self)
        return self
