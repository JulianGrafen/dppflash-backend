"""
ESPR Auditor Agent — CO₂ mapping + schema validation (Flowchart: orange agent after mass balance).
"""

from __future__ import annotations

from dataclasses import dataclass

from etl.graph.state import EspAuditReport, GapRecord
from etl.models.audit_field import AuditField, audit_text, audit_value
from etl.models.dpp_schemas import DPPAnalysisResult

_FULL_COMPLIANCE_THRESHOLD = 100.0


@dataclass(frozen=True)
class EspAuditOutcome:
    report: EspAuditReport
    gaps: list[GapRecord]


def _apply_co2_proxy_mapping(result: DPPAnalysisResult) -> tuple[bool, str | None]:
    """
    Apply EU emissions-factor / CO₂ proxy mapping when no explicit footprint exists.

    Enterprise integration point: replace with real emission-factor DB lookup.
    """
    if result.sustainability is None:
        return False, None

    footprint = audit_text(result.sustainability.environmental_footprint)
    if footprint:
        return False, "Explicit environmental footprint already present — no proxy applied."

    category = result.product_category.value
    proxy_note = (
        f"CO₂ proxy placeholder applied for category {category}. "
        "Replace with delegated-act emission factors in production."
    )
    result.sustainability.environmental_footprint = AuditField.from_inference(
        f"Estimated proxy — pending verified LCA ({proxy_note})",
        source_detail="No explicit LCA footprint in source document — EU delegated-act proxy applied.",
    )
    return True, proxy_note


def run_espr_audit(result: DPPAnalysisResult) -> EspAuditOutcome:
    """
    Run ESPR schema validation, completeness check, and CO₂ proxy mapping.
    """
    gap_analysis = result.calculate_gap_analysis()
    missing_paths: list[str] = list(gap_analysis["missing_fields"])
    readiness = float(gap_analysis["score_percent"])

    co2_applied, co2_notes = _apply_co2_proxy_mapping(result)

    gaps = [
        GapRecord(
            field_path=path,
            reason="Required ESPR field missing after extraction.",
            severity="major",
        )
        for path in missing_paths
    ]

    schema_valid = isinstance(result, DPPAnalysisResult)
    is_fully_compliant = schema_valid and len(missing_paths) == 0 and readiness >= _FULL_COMPLIANCE_THRESHOLD

    issues: list[str] = []
    if missing_paths:
        issues.append(f"{len(missing_paths)} ESPR field(s) still missing.")
    if not schema_valid:
        issues.append("Extracted payload failed schema validation.")

    report = EspAuditReport(
        is_fully_compliant=is_fully_compliant,
        readiness_score_percent=readiness,
        schema_valid=schema_valid,
        co2_mapping_applied=co2_applied,
        co2_notes=co2_notes,
        missing_field_paths=missing_paths,
        gaps=gaps,
        issues=issues,
    )

    return EspAuditOutcome(report=report, gaps=gaps)
