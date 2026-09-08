"""Pydantic V2 models for the ESPR product passport (inbound push schema).

Design notes
------------
Every non-mandatory field is declared ``Optional`` with a ``None`` default so the
master-fallback merge (:func:`etl.dpp_flash.inbound.fusion.deep_merge_dpp`) can
distinguish "explicitly empty" from "provided". Only ``upi`` is mandatory — it is
the join key between the SAP master payload and any enrichment source.
"""

from __future__ import annotations

import re

from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

# GTIN-8 / GTIN-12 (UPC) / GTIN-13 (EAN) / GTIN-14 — digits only.
_GTIN_PATTERN = re.compile(r"^\d{8}$|^\d{12,14}$")


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

    ``upi`` (Unique Product Identifier) is the only mandatory field; everything
    else may arrive later from enrichment sources (master-fallback pattern).
    """

    model_config = ConfigDict(str_strip_whitespace=True)

    upi: str = Field(min_length=1, description="Unique Product Identifier (mandatory).")
    gtin: str | None = Field(default=None, description="GTIN-8/12/13/14, digits only.")
    weight: str | None = None
    is_draft: bool = True
    hersteller: str | None = Field(default=None, description="Legal manufacturer name (ERP master).")
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

    @model_validator(mode="before")
    @classmethod
    def _normalize_legacy_master_fields(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        payload = dict(data)
        legacy_address = payload.get("manufacturer_address")
        if legacy_address and not payload.get("herstelleradresse"):
            payload["herstelleradresse"] = legacy_address
        return payload
