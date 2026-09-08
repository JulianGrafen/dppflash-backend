"""Tests for draft → DPPAnalysisResult mapping."""

from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from etl.dpp_flash.inbound.draft_to_analysis import (
    passport_draft_to_analysis_result,
    resolve_analysis_for_validation,
)
from etl.dpp_flash.inbound.models import ProductPassportDraft
from etl.http_service import app
from etl.models.audit_field import audit_value

client = TestClient(app)


def test_passport_draft_maps_core_erp_fields() -> None:
    draft = ProductPassportDraft(
        upi="LOC-400-25",
        gtin="04001234987654",
        weight="25.000 KG",
        hersteller="TechVolt GmbH",
        herstelleradresse="TechVolt GmbH, Berlin",
        disposal_instructions="Restmüll",
    )
    result = passport_draft_to_analysis_result(draft)

    assert audit_value(result.identification.unique_product_identifier) == "LOC-400-25"
    assert audit_value(result.identification.gtin_or_equivalent) == "04001234987654"
    assert audit_value(result.product_details.product_weight) == "25.000 KG"
    assert audit_value(result.economic_operator.manufacturer_name) == "TechVolt GmbH"
    assert audit_value(result.economic_operator.manufacturer_address) == "TechVolt GmbH, Berlin"
    assert audit_value(result.sustainability.end_of_life_treatment) == "Restmüll"


def test_resolve_prefers_pdf_extraction_and_fills_gaps_from_erp() -> None:
    draft = ProductPassportDraft(upi="LOC-400-25", gtin="04001234987654")
    pdf_json = {
        "product_category": "GENERIC",
        "identification": {
            "unique_product_identifier": {
                "value": "PDF-UPC",
                "source_system": "DOCUMENT_SDS",
                "source_detail": "SDS header",
            }
        },
        "metadata": {},
    }
    result = resolve_analysis_for_validation(draft, pdf_json)

    assert audit_value(result.identification.unique_product_identifier) == "PDF-UPC"
    assert audit_value(result.identification.gtin_or_equivalent) == "04001234987654"


def test_extended_fixture_upload_then_validate_has_score() -> None:
    fixture = (
        Path(__file__).resolve().parent.parent / "fixtures" / "mock_kmu_export_extended.xlsx"
    )
    content = fixture.read_bytes()
    upload = client.post(
        "/api/v1/kmu/upload-erp-export",
        files={"file": (fixture.name, content, "application/octet-stream")},
        data={"tenant_id": "validate-tenant"},
    )
    assert upload.status_code == 201
    first_upi = upload.json()["items"][0]["upi"]

    validate = client.post(
        "/api/v1/dpp/validate",
        json={"tenant_id": "validate-tenant", "upi": first_upi},
    )
    assert validate.status_code == 200
    body = validate.json()
    assert body["upi"] == first_upi
    assert "readiness_score_percent" in body
    assert body["gap_count"] > 0
