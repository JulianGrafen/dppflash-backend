"""Tests for SAP enrichment cascade and sap_enrichment_node."""

from __future__ import annotations

from etl.dpp_flash.nodes import sap_enrichment_node
from etl.dpp_flash.services.sap_enrichment import (
    EMAIL_SOURCE_PO,
    EMAIL_SOURCE_SRM,
    EMAIL_SOURCE_VENDOR,
    resolve_supplier_email,
)
from etl.dpp_flash.state import (
    STATUS_EMAIL_FOUND,
    STATUS_REQUIRES_HUMAN_INTERVENTION,
    initial_state,
)


def _state_with_supplier(supplier_id: str, *, product_id: str = "SKU-100") -> dict:
    base = initial_state(product_id=product_id, raw_document="x")
    base["extracted_data"] = {"supplier_id": supplier_id, "manufacturer": "Acme GmbH"}
    return base


def test_cascade_step1_srm_hit() -> None:
    result = resolve_supplier_email("SKU-100", "SRM-HIT-001")
    assert result is not None
    assert result.email.source_system == EMAIL_SOURCE_SRM
    assert "srm-supplier" in str(result.email.value)


def test_cascade_step2_po_hit_after_srm_miss() -> None:
    result = resolve_supplier_email("SKU-200", "PO-HIT-002")
    assert result is not None
    assert result.email.source_system == EMAIL_SOURCE_PO


def test_cascade_step3_vendor_master_hit() -> None:
    result = resolve_supplier_email("SKU-300", "VENDOR-HIT-003")
    assert result is not None
    assert result.email.source_system == EMAIL_SOURCE_VENDOR


def test_cascade_srm_error_falls_back_to_vendor() -> None:
    result = resolve_supplier_email("SKU-400", "muster-gmbh")
    assert result is not None
    assert result.email.source_system == EMAIL_SOURCE_VENDOR


def test_cascade_all_miss_returns_none() -> None:
    assert resolve_supplier_email("SKU-404", "NO-EMAIL-404") is None


def test_sap_enrichment_node_email_found() -> None:
    update = sap_enrichment_node(_state_with_supplier("SRM-HIT-001"))  # type: ignore[arg-type]
    assert update["status"] == STATUS_EMAIL_FOUND
    assert update["email_found"] is True
    assert update["email_source"] == EMAIL_SOURCE_SRM
    assert update["supplier_email"]


def test_sap_enrichment_node_requires_human() -> None:
    update = sap_enrichment_node(_state_with_supplier("NO-EMAIL-404"))  # type: ignore[arg-type]
    assert update["status"] == STATUS_REQUIRES_HUMAN_INTERVENTION
    assert update["email_found"] is False
    assert update["supplier_email"] is None


def test_sap_enrichment_node_po_source() -> None:
    update = sap_enrichment_node(_state_with_supplier("PO-HIT-002"))  # type: ignore[arg-type]
    assert update["email_source"] == EMAIL_SOURCE_PO
    assert update["status"] == STATUS_EMAIL_FOUND
