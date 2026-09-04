"""Tests for SCIP → contains_svhc cross-field validation."""

from __future__ import annotations

from etl.models.audit_field import audit_value
from etl.models.dpp_schemas import (
    DPPAnalysisResult,
    DPPExtractionOutput,
    DPPIdentification,
    ExtractProductDetails,
    ProductCategory,
    scip_number_present,
)


SCIP_LINE = "SCIP-Nr.: 550e8400-e29b-41d4-a716-446655440000"


def test_scip_number_present_explicit_label() -> None:
    assert scip_number_present(SCIP_LINE) is True


def test_scip_number_present_proximate_uuid() -> None:
    text = "Gemeldet in SCIP\nReferenz 550e8400-e29b-41d4-a716-446655440000"
    assert scip_number_present(text) is True


def test_scip_number_absent_without_uuid() -> None:
    assert scip_number_present("Keine SCIP Meldung erforderlich.") is False


def test_analysis_result_sets_contains_svhc_from_warnings_field() -> None:
    result = DPPAnalysisResult.model_validate(
        {
            "product_category": "GENERIC",
            "product_details": {
                "category": "GENERIC",
                "contains_svhc": None,
                "warnings_safety_information": SCIP_LINE,
            },
        }
    )
    assert result.product_details is not None
    assert audit_value(result.product_details.contains_svhc) is True


def test_analysis_result_overrides_false_contains_svhc() -> None:
    result = DPPAnalysisResult.model_validate(
        {
            "product_category": "GENERIC",
            "product_details": {
                "category": "GENERIC",
                "contains_svhc": False,
                "warnings_safety_information": SCIP_LINE,
            },
        }
    )
    assert result.product_details is not None
    assert audit_value(result.product_details.contains_svhc) is True


def test_extraction_output_sets_contains_svhc() -> None:
    output = DPPExtractionOutput.model_validate(
        {
            "product_category": "GENERIC",
            "product_details": {
                "contains_svhc": None,
                "location_of_substances": SCIP_LINE,
            },
        }
    )
    assert output.product_details is not None
    assert audit_value(output.product_details.contains_svhc) is True


def test_extraction_output_to_analysis_result_preserves_svhc() -> None:
    output = DPPExtractionOutput(
        product_category=ProductCategory.GENERIC,
        product_details=ExtractProductDetails(
            contains_svhc=None,
            warnings_safety_information=SCIP_LINE,
        ),
        identification=DPPIdentification(unique_product_identifier="SKU-1"),
    )
    result = output.to_analysis_result()
    assert result.product_details is not None
    assert audit_value(result.product_details.contains_svhc) is True
