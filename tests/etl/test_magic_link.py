"""Tests for supplier outreach magic link tokens."""

from __future__ import annotations

import pytest

from etl.graph.state import GapRecord
from etl.services.magic_link import (
    MagicLinkError,
    build_supplier_magic_link,
    sign_outreach_payload,
    token_hash,
    verify_outreach_token,
)


@pytest.fixture(autouse=True)
def _secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SUPPLIER_OUTREACH_SECRET", "test-secret-key-for-magic-link")
    monkeypatch.setenv("NEXT_PUBLIC_DPP_URL", "https://app.example.com")


def test_sign_and_verify_roundtrip() -> None:
    _, url = build_supplier_magic_link(
        product_identifier="000000000010048921",
        recipient_email="stefan.meier@covestro.corp",
        supplier_name="Covestro Deutschland AG",
        gaps=[
            GapRecord(
                field_path="sustainability.environmental_footprint",
                reason="Missing LCA.",
            )
        ],
    )
    token = url.rsplit("/", 1)[-1]
    payload = verify_outreach_token(token)
    assert payload["recipient_email"] == "stefan.meier@covestro.corp"
    assert payload["product_identifier"] == "000000000010048921"
    assert len(payload["gaps"]) == 1


def test_tampered_token_rejected() -> None:
    payload = {
        "product_identifier": "SKU-1",
        "recipient_email": "a@b.c",
        "supplier_name": None,
        "gaps": [],
        "issued_at": "2026-01-01T00:00:00+00:00",
        "expires_at": "2099-01-01T00:00:00+00:00",
    }
    token = sign_outreach_payload(payload)
    tampered = token[:-1] + ("0" if token[-1] != "0" else "1")
    with pytest.raises(MagicLinkError):
        verify_outreach_token(tampered)


def test_token_hash_is_stable() -> None:
    assert token_hash("abc") == token_hash("abc")
    assert token_hash("abc") != token_hash("abcd")
