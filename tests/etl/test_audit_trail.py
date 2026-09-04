"""Tests for AuditField model and audit trail integration."""

from __future__ import annotations

import json

from etl.models.audit_field import AuditField, SourceSystem, audit_value
from etl.models.dpp_schemas import (
    DPPAnalysisResult,
    DPPExtractionOutput,
    DPPIdentification,
    ExtractSustainability,
    GenericProductDetails,
    GenericSustainability,
    ProductCategory,
)
from etl.dpp_flash.services.sap_mock import fetch_sap_vendor_master
from scripts.demo_audit_trail import build_simulated_extraction
from etl.services.validation import validate_extracted_data


def test_audit_field_coerces_legacy_primitive() -> None:
    field = AuditField.model_validate("hello")
    assert field.value == "hello"
    assert field.source_system == SourceSystem.DOCUMENT_SDS


def test_sap_mock_returns_audit_field_with_table_path() -> None:
    field = fetch_sap_vendor_master("VENDOR-HIT-003")
    assert field is not None
    assert field.value == "info@vendor-master.example"
    assert field.source_system == SourceSystem.SAP_VENDOR_MASTER.value
    assert "LFA1" in (field.source_detail or "")


def test_extraction_output_preserves_audit_trail() -> None:
    result = build_simulated_extraction().to_analysis_result()
    composition = result.get_audit_field("sustainability.material_composition")
    assert composition is not None
    assert "62%" in str(composition.value)
    assert composition.source_detail is not None
    assert "Abschnitt 3" in composition.source_detail
    assert composition.timestamp is not None


def test_validation_mass_balance_uses_audited_composition() -> None:
    result = build_simulated_extraction().to_analysis_result()
    outcome = validate_extracted_data(result)
    assert outcome.report.mass_balance_ok is True
    assert outcome.report.mass_balance_total_percent == 100.0


def test_scip_inference_wraps_contains_svhc() -> None:
    scip_line = "SCIP-Nr.: 550e8400-e29b-41d4-a716-446655440000"
    result = DPPAnalysisResult(
        product_category=ProductCategory.GENERIC,
        product_details=GenericProductDetails(
            category=ProductCategory.GENERIC,
            warnings_safety_information=AuditField.from_document(scip_line, source_detail=scip_line),
        ),
    )
    assert audit_value(result.product_details.contains_svhc) is True
    assert result.product_details.contains_svhc.source_system == SourceSystem.SYSTEM_INFERENCE.value


def test_demo_audit_trail_json_shape() -> None:
    result = build_simulated_extraction().to_analysis_result()
    field = result.get_audit_field("sustainability.material_composition")
    dumped = json.loads(field.model_dump_json())
    assert set(dumped.keys()) == {"value", "source_system", "source_detail", "timestamp"}
