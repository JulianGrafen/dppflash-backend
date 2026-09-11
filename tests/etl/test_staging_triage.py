"""Unit tests for inbound staging triage."""

from __future__ import annotations

from etl.dpp_flash.inbound.staging_models import IngestPayload
from etl.dpp_flash.inbound.triage import process_incoming_data


def test_extract_anchor_from_sku_pending() -> None:
    event = process_incoming_data(
        {"SKU": "KMU-1001", "Title": "Widget"},
        "ERP_WEBHOOK",
        "tenant-a",
    )
    assert event.status == "PENDING"
    assert event.extracted_upi == "KMU-1001"
    assert event.payload["_meta"]["normalized_upi"] == "KMU-1001"


def test_extract_anchor_from_artikelnummer() -> None:
    event = process_incoming_data(
        {"Artikelnummer": "ART-42", "Gewicht": "1.2"},
        "CSV_UPLOAD",
        "tenant-a",
    )
    assert event.status == "PENDING"
    assert event.extracted_upi == "ART-42"


def test_gtin_fallback_when_no_upi() -> None:
    event = process_incoming_data(
        {"EAN": "4006381333931", "Name": "Orphan-ish"},
        "ERP_WEBHOOK",
        "tenant-a",
    )
    assert event.status == "PENDING"
    assert event.extracted_upi == "4006381333931"
    assert event.payload["_meta"]["normalized_gtin"] == "4006381333931"


def test_orphan_when_no_anchor() -> None:
    event = process_incoming_data(
        {"Title": "Unknown product", "Weight": "2kg"},
        "CSV_UPLOAD",
        "tenant-a",
    )
    assert event.status == "ORPHAN"
    assert event.extracted_upi is None


def test_ingest_payload_splits_additional_data() -> None:
    payload = IngestPayload.model_validate(
        {"SKU": "X-1", "gtin": "4006381333931", "custom_field": "value"},
    )
    assert payload.upi == "X-1"
    assert payload.gtin == "4006381333931"
    assert payload.additional_data.get("custom_field") == "value"
