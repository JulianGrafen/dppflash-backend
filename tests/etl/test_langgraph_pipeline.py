from __future__ import annotations

import pytest

from etl.graph.routing import (
    route_after_api_enrichment,
    route_after_espr_audit,
    route_after_sap_enrichment,
    route_after_supplier_outreach,
    route_after_validation,
)
from etl.graph.state import (
    DEFAULT_MAX_EXTRACTION_ATTEMPTS,
    EnrichmentAttemptResult,
    EnrichmentStage,
    EspAuditReport,
    GapRecord,
    ValidationReport,
    ValidationStatus,
)
from etl.models.dpp_schemas import (
    DPPAnalysisResult,
    DPPIdentification,
    ESPR_TOTAL_FIELD_COUNT,
    GenericProductDetails,
    GenericSustainability,
    ProductCategory,
    _ESPR_FIELD_REGISTRY,
)
from etl.models.audit_field import AuditField
from etl.services.gap_management import build_gap_remediation_plan
from etl.services.validation import validate_extracted_data


def test_espr_field_registry_includes_audit_leaf_fields() -> None:
    paths = _ESPR_FIELD_REGISTRY[ProductCategory.GENERIC]
    assert len(paths) > 0
    assert len(paths) <= ESPR_TOTAL_FIELD_COUNT
    assert "identification.unique_product_identifier" in paths
    assert "sustainability.material_composition" in paths


def test_gap_analysis_counts_filled_audit_fields() -> None:
    result = DPPAnalysisResult(
        product_category=ProductCategory.GENERIC,
        identification=DPPIdentification(
            unique_product_identifier=AuditField.from_document("HENK-X99", source_detail="quote"),
        ),
        sustainability=GenericSustainability(
            category=ProductCategory.GENERIC,
            material_composition=AuditField.from_document("Quarz 50%, Zement 50%", source_detail="sec 3"),
        ),
    )
    analysis = result.calculate_gap_analysis()
    assert analysis["total_fields"] > 0
    assert analysis["filled_fields"] >= 2
    assert analysis["score_percent"] > 0
    assert "identification.unique_product_identifier" in analysis["filled_field_names"]


def test_route_mass_balance_failure_goes_to_api_enrichment() -> None:
    state = {"validation_report": ValidationReport(mass_balance_ok=False)}
    assert route_after_validation(state) == "api_enrichment"


def test_route_mass_balance_ok_goes_to_espr_auditor() -> None:
    state = {"validation_report": ValidationReport(mass_balance_ok=True)}
    assert route_after_validation(state) == "espr_auditor"


def test_route_mass_balance_exhausted_goes_to_api_enrichment() -> None:
    state = {
        "validation_report": ValidationReport(mass_balance_ok=False),
        "extraction_attempt": DEFAULT_MAX_EXTRACTION_ATTEMPTS,
        "max_extraction_attempts": DEFAULT_MAX_EXTRACTION_ATTEMPTS,
    }
    assert route_after_validation(state) == "api_enrichment"


def test_route_espr_audit_compliant_goes_to_db() -> None:
    state = {"espr_audit_report": EspAuditReport(is_fully_compliant=True)}
    assert route_after_espr_audit(state) == "load_to_db"


def test_route_espr_audit_gaps_goes_to_api_enrichment() -> None:
    state = {"espr_audit_report": EspAuditReport(is_fully_compliant=False)}
    assert route_after_espr_audit(state) == "api_enrichment"


def test_route_api_enrichment_success_goes_to_db() -> None:
    state = {
        "enrichment_result": EnrichmentAttemptResult(
            stage=EnrichmentStage.API_LOOKUP,
            success=True,
            remaining_gaps=[],
        ),
        "gaps": [],
    }
    assert route_after_api_enrichment(state) == "load_to_db"


def test_route_api_enrichment_failure_goes_to_sap_enrichment() -> None:
    state = {
        "enrichment_result": EnrichmentAttemptResult(
            stage=EnrichmentStage.API_LOOKUP,
            success=False,
            remaining_gaps=[GapRecord(field_path="identification.gtin_or_equivalent", reason="missing")],
        ),
        "gaps": [GapRecord(field_path="identification.gtin_or_equivalent", reason="missing")],
    }
    assert route_after_api_enrichment(state) == "sap_enrichment"


def test_route_sap_enrichment_email_found_goes_to_supplier() -> None:
    state = {"email_found": True, "supplier_email": "info@supplier.example"}
    assert route_after_sap_enrichment(state) == "supplier_outreach"


def test_route_sap_enrichment_no_email_goes_to_escalate() -> None:
    state = {"email_found": False}
    assert route_after_sap_enrichment(state) == "escalate"


def test_route_supplier_success_goes_to_db() -> None:
    state = {
        "enrichment_result": EnrichmentAttemptResult(stage=EnrichmentStage.SUPPLIER_OUTREACH, success=True),
    }
    assert route_after_supplier_outreach(state) == "load_to_db"


def test_route_supplier_failure_goes_to_escalate() -> None:
    state = {
        "enrichment_result": EnrichmentAttemptResult(stage=EnrichmentStage.SUPPLIER_OUTREACH, success=False),
    }
    assert route_after_supplier_outreach(state) == "escalate"


def test_validate_detects_mass_balance_failure() -> None:
    result = DPPAnalysisResult(
        product_category=ProductCategory.GENERIC,
        identification=DPPIdentification(unique_product_identifier="Test"),
        product_details=GenericProductDetails(),
        sustainability=GenericSustainability(material_composition="Quarz 60%; Zement 50%"),
    )
    outcome = validate_extracted_data(result)
    assert outcome.report.mass_balance_ok is False


def test_gap_remediation_summarises_gaps() -> None:
    gaps = [GapRecord(field_path="identification.gtin_or_equivalent", reason="missing")]
    result = DPPAnalysisResult(
        product_category=ProductCategory.GENERIC,
        identification=DPPIdentification(unique_product_identifier="Cimsec Fliesen Kleber"),
    )
    plan = build_gap_remediation_plan(gaps, result)
    assert plan.gap_count == 1


def test_graph_compiles_when_langgraph_installed() -> None:
    pytest.importorskip("langgraph")
    from etl.graph.graph import build_dpp_extraction_graph

    compiled = build_dpp_extraction_graph()
    assert compiled is not None
    assert "extraction_phase" in compiled.get_graph().nodes
    assert "prepare_input" in compiled.get_graph().nodes
    assert "sap_enrichment" in compiled.get_graph().nodes
