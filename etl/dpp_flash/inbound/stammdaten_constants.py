"""Shared Stammdaten field keys — entered per tenant, not from product Excel."""

from __future__ import annotations

STAMMDATEN_PAYLOAD_KEYS = frozenset(
    {
        "hersteller",
        "herstelleradresse",
        "manufacturer_address",
        "eori",
        "kontakt",
        "kontakt_name",
        "kontakt_email",
        "kontakt_phone",
    }
)
