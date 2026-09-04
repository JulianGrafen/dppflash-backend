"""Tests for strict JSON-based outreach recipient resolution."""

from __future__ import annotations

import asyncio

import pytest

from etl.graph.nodes.supplier_outreach import supplier_outreach_node
from etl.graph.state import GapRecord
from etl.models.audit_field import AuditField
from etl.models.dpp_schemas import DPPAnalysisResult, DPPEconomicOperator, ProductCategory
from etl.services.enrichment import send_supplier_outreach
from etl.services.outreach_recipient import resolve_outreach_recipient_from_json
from tests.etl.test_sap_product_odata_ingest import SAMPLE_A_PRODUCT

OUTREACH_SECRET = "test-secret-key-for-magic-link"


@pytest.fixture(autouse=True)
def _outreach_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SUPPLIER_OUTREACH_SECRET", OUTREACH_SECRET)
    monkeypatch.setenv("NEXT_PUBLIC_DPP_URL", "https://app.example.com")


def test_resolve_outreach_recipient_reads_current_json() -> None:
    contact = resolve_outreach_recipient_from_json(SAMPLE_A_PRODUCT)
    assert contact is not None
    assert contact.value == "stefan.meier@covestro.corp"


def test_resolve_outreach_recipient_reflects_json_edit() -> None:
    edited = {
        "d": {
            "Product": "1",
            "to_BillOfMaterial": {
                "results": [
                    {
                        "to_BOMItems": {
                            "results": [
                                {
                                    "to_PurchasingInfo": {
                                        "SupplierName": "Test AG",
                                        "to_SupplierDetails": {
                                            "to_ContactPerson": {
                                                "results": [
                                                    {
                                                        "FirstName": "Maria",
                                                        "LastName": "Keller",
                                                        "Department": "Compliance",
                                                        "EmailAddress": "maria.keller@test.ag",
                                                    }
                                                ]
                                            }
                                        },
                                    }
                                }
                            ]
                        }
                    }
                ]
            },
        }
    }

    contact = resolve_outreach_recipient_from_json(edited)
    assert contact is not None
    assert contact.value == "maria.keller@test.ag"


def test_supplier_outreach_node_uses_current_json_not_state_cache(monkeypatch) -> None:
    monkeypatch.delenv("SUPPLIER_OUTREACH_ENABLED", raising=False)

    update = asyncio.run(
        supplier_outreach_node(  # type: ignore[arg-type]
            {
                "sap_export": SAMPLE_A_PRODUCT,
                "extracted_data": DPPAnalysisResult(
                    product_category=ProductCategory.GENERIC,
                    economic_operator=DPPEconomicOperator(
                        electronic_contact_details=AuditField.from_document(
                            "info@muster-klebstoff.de",
                        )
                    ),
                ),
                "gaps": [],
                "metadata": {},
                "supplier_email": AuditField.from_document("cached@wrong.example"),
            }
        )
    )

    assert "errors" not in update
    assert update["metadata"]["outreach_recipient"] == "stefan.meier@covestro.corp"


def test_send_supplier_outreach_re_parses_json_on_send(monkeypatch) -> None:
    monkeypatch.delenv("SUPPLIER_OUTREACH_ENABLED", raising=False)

    result = send_supplier_outreach(
        extracted_data=DPPAnalysisResult(product_category=ProductCategory.GENERIC),
        gaps=[],
        product_identifier="SKU-1",
        sap_export=SAMPLE_A_PRODUCT,
    )

    assert result.success is True
    assert "stefan.meier@covestro.corp" in (result.notes or "")
    assert "/supplier/outreach/" in (result.notes or "")


def test_send_supplier_outreach_generates_magic_link(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SUPPLIER_OUTREACH_ENABLED", raising=False)

    result = send_supplier_outreach(
        extracted_data=DPPAnalysisResult(product_category=ProductCategory.GENERIC),
        gaps=[
            GapRecord(field_path="sustainability.resource_use", reason="missing"),
        ],
        product_identifier="000000000010048921",
        sap_export=SAMPLE_A_PRODUCT,
    )

    assert result.success is True
    assert result.notes is not None
    assert "Magic link: https://app.example.com/supplier/outreach/" in result.notes
