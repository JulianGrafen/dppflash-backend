"""Tests for the ESPR Pydantic models (inbound push schema)."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from etl.dpp_flash.inbound.models import BillOfMaterialItem, Contact, ProductPassportDraft


def test_minimal_draft_only_needs_upi() -> None:
    draft = ProductPassportDraft(upi="UPI-1")

    assert draft.upi == "UPI-1"
    assert draft.is_draft is True
    assert draft.gtin is None
    assert draft.safety_warnings == []
    assert draft.bom == []


def test_upi_is_mandatory() -> None:
    with pytest.raises(ValidationError):
        ProductPassportDraft()  # type: ignore[call-arg]


@pytest.mark.parametrize("gtin", ["40063813", "400638133339", "4006381333931", "04006381333931"])
def test_valid_gtin_lengths_accepted(gtin: str) -> None:
    assert ProductPassportDraft(upi="U", gtin=gtin).gtin == gtin


@pytest.mark.parametrize("gtin", ["123", "abcdefgh", "40063813339312345"])
def test_invalid_gtin_rejected(gtin: str) -> None:
    with pytest.raises(ValidationError):
        ProductPassportDraft(upi="U", gtin=gtin)


def test_empty_gtin_normalized_to_none() -> None:
    assert ProductPassportDraft(upi="U", gtin="").gtin is None


def test_contact_email_is_validated() -> None:
    with pytest.raises(ValidationError):
        Contact(email="not-an-email")


def test_nested_bom_item_parses() -> None:
    item = BillOfMaterialItem(
        bom_number="B1",
        supplier_contact={"name": "S1", "email": "s1@example.com"},  # type: ignore[arg-type]
    )

    assert item.supplier_contact is not None
    assert item.supplier_contact.email == "s1@example.com"
    assert item.svhc_status is None
