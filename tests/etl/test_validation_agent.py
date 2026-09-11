from __future__ import annotations

from etl.graph.state import ValidationStatus
from etl.models.audit_field import AuditField
from etl.models.dpp_schemas import (
    DPPAnalysisResult,
    DPPIdentification,
    DPPEconomicOperator,
    GenericSustainability,
    ProductCategory,
    TextileProductDetails,
)
from etl.services.validation import validate_extracted_data
from etl.services.validation_agent import run_validation_agent


def _result_with_composition(text: str) -> DPPAnalysisResult:
    return DPPAnalysisResult(
        product_category=ProductCategory.GENERIC,
        sustainability=GenericSustainability(
            category=ProductCategory.GENERIC,
            material_composition=AuditField.from_document(text, source_detail="sec 3"),
        ),
    )


def test_mass_balance_passes_at_100_percent() -> None:
    outcome = run_validation_agent(_result_with_composition("Quarz 50%, Zement 50%"))
    assert outcome.report.passed is True
    assert outcome.report.mass_balance_total_percent == 100.0
    assert not any(f.rule_id == "mass_balance" for f in outcome.report.findings)


def test_mass_balance_fails_at_99_percent() -> None:
    outcome = run_validation_agent(_result_with_composition("Fiber A 49%, Fiber B 50%"))
    assert outcome.report.passed is False
    assert outcome.report.mass_balance_total_percent == 99.0
    assert any(f.rule_id == "mass_balance" and f.severity == "critical" for f in outcome.report.findings)


def test_mass_balance_fails_above_tolerance() -> None:
    outcome = run_validation_agent(_result_with_composition("A 50.3%, B 50.3%"))
    assert outcome.report.passed is False
    assert outcome.report.mass_balance_total_percent == 100.6


def test_gtin_valid_checksum() -> None:
    result = DPPAnalysisResult(
        product_category=ProductCategory.GENERIC,
        identification=DPPIdentification(
            gtin_or_equivalent=AuditField.from_document("4006381333931", source_detail="label"),
        ),
    )
    outcome = run_validation_agent(result)
    assert outcome.report.gtin_checked is True
    assert outcome.report.gtin_valid is True
    assert not any(f.rule_id == "gtin_checksum" for f in outcome.report.findings)


def test_gtin_invalid_checksum() -> None:
    result = DPPAnalysisResult(
        product_category=ProductCategory.GENERIC,
        identification=DPPIdentification(
            gtin_or_equivalent=AuditField.from_document("4006381333930", source_detail="label"),
        ),
    )
    outcome = run_validation_agent(result)
    assert outcome.report.gtin_checked is True
    assert outcome.report.gtin_valid is False
    assert any(f.rule_id == "gtin_checksum" and f.severity == "major" for f in outcome.report.findings)


def test_gtin_skips_placeholder() -> None:
    result = DPPAnalysisResult(
        product_category=ProductCategory.GENERIC,
        identification=DPPIdentification(
            gtin_or_equivalent=AuditField.from_document("PENDING_EXTERNAL_MATCH", source_detail="n/a"),
        ),
    )
    outcome = run_validation_agent(result)
    assert outcome.report.gtin_checked is False
    assert not any(f.rule_id == "gtin_checksum" for f in outcome.report.findings)


def test_recycled_percent_over_100_is_major() -> None:
    result = DPPAnalysisResult(
        product_category=ProductCategory.TEXTILES_APPAREL,
        product_details=TextileProductDetails(
            category=ProductCategory.TEXTILES_APPAREL,
            recycled_content_by_material=AuditField.from_document(
                "Polyester 120% recycled",
                source_detail="label",
            ),
        ),
        sustainability=GenericSustainability(
            category=ProductCategory.GENERIC,
            material_composition=AuditField.from_document("Cotton 100%", source_detail="sec 3"),
        ),
    )
    outcome = run_validation_agent(result)
    assert any(
        f.rule_id == "recycled_percent_bounds" and f.severity == "major"
        for f in outcome.report.findings
    )


def test_validate_extracted_data_integrates_agent_mass_balance_gap() -> None:
    outcome = validate_extracted_data(_result_with_composition("Only 40% cotton"))
    assert outcome.report.mass_balance_ok is False
    assert outcome.report.status == ValidationStatus.INVALID
    assert any(g.field_path == "sustainability.material_composition" for g in outcome.gaps)
    assert outcome.agent_report.passed is False


def test_contact_email_warning() -> None:
    result = DPPAnalysisResult(
        product_category=ProductCategory.GENERIC,
        economic_operator=DPPEconomicOperator(
            electronic_contact_details=AuditField.from_document("bad@@email", source_detail="card"),
        ),
    )
    outcome = run_validation_agent(result)
    assert outcome.report.passed is True
    assert any(f.rule_id == "contact_email_shape" for f in outcome.report.findings)
