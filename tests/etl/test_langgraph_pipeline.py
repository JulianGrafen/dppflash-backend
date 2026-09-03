from __future__ import annotations

import pytest

from etl.graph.routing import (
    route_after_api_enrichment,
    route_after_espr_audit,
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
from etl.models.dpp_schemas import DPPAnalysisResult, DPPIdentification, GenericProductDetails, GenericSustainability, ProductCategory
from etl.services.gap_management import build_gap_remediation_plan
from etl.services.validation import validate_extracted_data


def test_route_mass_balance_failure_retries_extractor() -> None:
    state = {
        "validation_report": ValidationReport(mass_balance_ok=False, mass_balance_total_percent=110.0),
        "extraction_attempt": 1,
        "max_extraction_attempts": DEFAULT_MAX_EXTRACTION_ATTEMPTS,
    }
    assert route_after_validation(state) == "extractor"


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


def test_route_api_enrichment_failure_goes_to_supplier() -> None:
    state = {
        "enrichment_result": EnrichmentAttemptResult(
            stage=EnrichmentStage.API_LOOKUP,
            success=False,
            remaining_gaps=[GapRecord(field_path="identification.gtin_or_equivalent", reason="missing")],
        ),
        "gaps": [GapRecord(field_path="identification.gtin_or_equivalent", reason="missing")],
    }
    assert route_after_api_enrichment(state) == "supplier_outreach"


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

    assert build_dpp_extraction_graph() is not None
