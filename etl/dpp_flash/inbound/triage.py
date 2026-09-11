"""Triage incoming inbound data before staging merge."""

from __future__ import annotations

import re
from typing import Any

from etl.dpp_flash.inbound.kmu_upload import KMU_COLUMN_ALIASES
from etl.dpp_flash.inbound.staging_models import StagingEventCreate, StagingSource

_DIRECT_UPI_KEYS = frozenset({"upi", "sku", "artikelnummer", "matnr", "productid", "product_id"})
_DIRECT_GTIN_KEYS = frozenset({"gtin", "ean", "ean13", "barcode"})


def _normalize_key(value: object) -> str:
    text = str(value).strip().casefold()
    return re.sub(r"[\s.\-_/():#,]+", "", text)


def _build_alias_lookup() -> dict[str, str]:
    """Map normalized header keys to canonical anchor fields (upi / gtin)."""
    lookup: dict[str, str] = {}
    for canonical, labels in KMU_COLUMN_ALIASES.items():
        if canonical not in {"upi", "gtin"}:
            continue
        for label in labels:
            for variant in (label.casefold(), _normalize_key(label)):
                lookup[variant] = canonical
    for key in _DIRECT_UPI_KEYS:
        lookup[key] = "upi"
    for key in _DIRECT_GTIN_KEYS:
        lookup[key] = "gtin"
    return lookup


_ALIAS_LOOKUP = _build_alias_lookup()


def _string_value(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _extract_anchor(raw_data: dict[str, Any]) -> tuple[str | None, str | None]:
    """Return (upi, gtin) extracted from arbitrary key names."""
    upi: str | None = None
    gtin: str | None = None

    for key, value in raw_data.items():
        text = _string_value(value)
        if not text:
            continue
        for lookup_key in (_normalize_key(key), str(key).strip().casefold()):
            canonical = _ALIAS_LOOKUP.get(lookup_key)
            if canonical == "upi" and upi is None:
                upi = text
            elif canonical == "gtin" and gtin is None:
                gtin = text

    return upi, gtin


def process_incoming_data(
    raw_data: dict[str, Any],
    source: StagingSource,
    tenant_id: str,
) -> StagingEventCreate:
    """Classify one inbound payload and build a staging event (no DB write).

    Rules:
    - Anchor found (UPI/SKU, else GTIN/EAN) → status PENDING, extracted_upi set.
    - No anchor → status ORPHAN, extracted_upi None.
    """
    upi, gtin = _extract_anchor(raw_data)
    extracted_upi = upi or gtin
    status = "PENDING" if extracted_upi else "ORPHAN"

    payload = {
        **raw_data,
        "_meta": {
            "source": source,
            "normalized_upi": upi,
            "normalized_gtin": gtin,
        },
    }

    return StagingEventCreate(
        tenant_id=tenant_id,
        source=source,
        extracted_upi=extracted_upi,
        payload=payload,
        status=status,
    )
