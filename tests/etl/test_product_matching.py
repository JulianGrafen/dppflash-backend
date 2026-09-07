"""Tests for product matching and fusion into masters."""

from __future__ import annotations

from etl.dpp_flash.inbound.fusion_service import try_auto_match_and_fuse
from etl.dpp_flash.inbound.models import ProductPassportDraft
from etl.dpp_flash.inbound.product_matcher import find_master_for_enrichment


def _master(upi: str, gtin: str | None = None) -> dict:
    return {
        "tenant_id": "tenant-1",
        "upi": upi,
        "source": "kmu_excel",
        "match_status": "master",
        "payload": {"upi": upi, "gtin": gtin},
    }


def test_match_by_upi() -> None:
    enrichment = ProductPassportDraft(upi="KMU-1001", gtin=None)
    master_upi, reason = find_master_for_enrichment(
        enrichment, [_master("KMU-1001"), _master("KMU-1002")]
    )
    assert master_upi == "KMU-1001"
    assert reason == "upi"


def test_match_by_gtin_when_upi_differs() -> None:
    enrichment = ProductPassportDraft(upi="PDF-sdb", gtin="4006381333931")
    master_upi, reason = find_master_for_enrichment(
        enrichment, [_master("KMU-1001", "4006381333931")]
    )
    assert master_upi == "KMU-1001"
    assert reason == "gtin"


def test_no_match_returns_unmatched_row() -> None:
    enrichment = ProductPassportDraft(upi="PDF-orphan", gtin="11111111")
    row, reason, master_upi = try_auto_match_and_fuse(
        enrichment,
        "tenant-1",
        [_master("KMU-1001", "4006381333931")],
        raw_extraction={"product_category": "GENERIC"},
    )
    assert reason == "none"
    assert master_upi is None
    assert row["match_status"] == "unmatched"
    assert row["source"] == "pdf_extract"


def test_fuse_fills_empty_master_fields() -> None:
    enrichment = ProductPassportDraft(upi="KMU-1001", weight="12.5 kg")
    row, reason, master_upi = try_auto_match_and_fuse(
        enrichment,
        "tenant-1",
        [_master("KMU-1001")],
    )
    assert reason == "upi"
    assert master_upi == "KMU-1001"
    assert row["match_status"] == "enriched"
    assert row["payload"]["weight"] == "12.5 kg"
