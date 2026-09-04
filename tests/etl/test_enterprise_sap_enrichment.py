"""Tests for enterprise sap_enrichment_node."""

from __future__ import annotations

import asyncio

from etl.graph.nodes.sap_enrichment import sap_enrichment_node
from etl.graph.state import EnrichmentStage, SkuMasterData
from etl.models.audit_field import audit_text
from etl.models.dpp_schemas import DPPAnalysisResult, DPPEconomicOperator, DPPIdentification, ProductCategory


def test_sap_enrichment_node_resolves_vendor_master_email() -> None:
    state = {
        "sku_master_data": SkuMasterData(sku="670689"),
        "extracted_data": DPPAnalysisResult(
            product_category=ProductCategory.GENERIC,
            identification=DPPIdentification(unique_product_identifier="670689"),
            economic_operator=DPPEconomicOperator(manufacturer_name="Muster GmbH"),
        ),
        "metadata": {"supplier_id": "VENDOR-HIT-003"},
    }
    update = asyncio.run(sap_enrichment_node(state))  # type: ignore[arg-type]

    assert update["email_found"] is True
    assert audit_text(update["supplier_email"]) == "info@vendor-master.example"
    assert update["email_source"] == "SAP_VENDOR_MASTER"
    assert update["enrichment_stage"] == EnrichmentStage.SAP_EMAIL_LOOKUP


def test_sap_enrichment_node_no_email_escalates() -> None:
    state = {
        "sku_master_data": SkuMasterData(sku="670689"),
        "extracted_data": DPPAnalysisResult(
            product_category=ProductCategory.GENERIC,
            identification=DPPIdentification(unique_product_identifier="670689"),
        ),
        "metadata": {"supplier_id": "NO-EMAIL-404"},
    }
    update = asyncio.run(sap_enrichment_node(state))  # type: ignore[arg-type]

    assert update["email_found"] is False
    assert update["supplier_email"] is None
    assert update["errors"]


def test_sap_enrichment_node_prefers_contact_scorer_odata() -> None:
    state = {
        "sku_master_data": SkuMasterData(sku="670689"),
        "metadata": {"supplier_id": "VENDOR-HIT-003"},
        "supplier_odata": {
            "DefaultEmailAddress": "info@supplier.example",
            "to_ContactPerson": [
                {
                    "FirstName": "Anna",
                    "LastName": "Schmidt",
                    "Department": "Compliance",
                    "EmailAddress": "anna.schmidt@supplier.example",
                }
            ],
        },
    }
    update = asyncio.run(sap_enrichment_node(state))  # type: ignore[arg-type]

    assert update["email_found"] is True
    assert audit_text(update["supplier_email"]) == "anna.schmidt@supplier.example"
    assert "Compliance" in (update["supplier_email"].source_detail or "")


def test_sap_enrichment_node_odata_blacklist_escalates_without_cascade() -> None:
    state = {
        "sku_master_data": SkuMasterData(sku="670689"),
        "metadata": {"supplier_id": "VENDOR-HIT-003"},
        "supplier_odata": {
            "DefaultEmailAddress": "rechnungseingang@supplier.example",
        },
    }
    update = asyncio.run(sap_enrichment_node(state))  # type: ignore[arg-type]

    assert update["email_found"] is False
    assert update["supplier_email"] is None
    assert any("ContactScorer" in err for err in update["errors"])
