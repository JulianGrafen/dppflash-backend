"""
Deterministic validation for extracted DPP payloads.

Checks
------
1. ESPR field completeness (via `DPPAnalysisResult.calculate_gap_analysis()`).
2. Validation Agent plausibility rules (mass balance, GTIN, recycled %, etc.).
"""

from __future__ import annotations

from dataclasses import dataclass

from etl.graph.state import GapRecord, ValidationReport, ValidationStatus
from etl.models.dpp_schemas import DPPAnalysisResult
from etl.services.validation_agent import ValidationAgentReport, run_validation_agent

_MIN_READINESS_FOR_VALID = 100.0


@dataclass(frozen=True)
class ValidationOutcome:
    report: ValidationReport
    gaps: list[GapRecord]
    agent_report: ValidationAgentReport


def validate_extracted_data(result: DPPAnalysisResult) -> ValidationOutcome:
    """
    Validate extracted DPP data and derive gap records for downstream remediation.
    """
    gap_analysis = result.calculate_gap_analysis()
    missing_paths: list[str] = list(gap_analysis["missing_fields"])
    readiness = float(gap_analysis["score_percent"])

    agent_outcome = run_validation_agent(result)
    agent_report: ValidationAgentReport = agent_outcome.report

    mass_balance_ok = agent_report.mass_balance_total_percent is None or not any(
        f.rule_id == "mass_balance" and f.severity == "critical" for f in agent_report.findings
    )
    mass_total = agent_report.mass_balance_total_percent

    issues: list[str] = [f.message for f in agent_report.findings]

    gaps: list[GapRecord] = [
        GapRecord(
            field_path=path,
            reason="Required ESPR field is empty or missing in the extraction result.",
            severity="major",
        )
        for path in missing_paths
    ]

    seen_gap_paths = {g.field_path for g in gaps}
    for finding in agent_report.findings:
        if finding.severity not in ("critical", "major"):
            continue
        if finding.field_path in seen_gap_paths:
            continue
        seen_gap_paths.add(finding.field_path)
        gap_severity = "critical" if finding.severity == "critical" else "major"
        gaps.append(
            GapRecord(
                field_path=finding.field_path,
                reason=finding.message,
                severity=gap_severity,
            )
        )

    agent_passed = agent_report.passed
    is_complete = (
        len(missing_paths) == 0
        and mass_balance_ok
        and agent_passed
        and readiness >= _MIN_READINESS_FOR_VALID
    )
    status = ValidationStatus.VALID if is_complete else ValidationStatus.INVALID

    report = ValidationReport(
        status=status,
        is_complete=is_complete,
        mass_balance_ok=mass_balance_ok,
        mass_balance_total_percent=mass_total,
        readiness_score_percent=readiness,
        missing_field_paths=missing_paths,
        issues=issues,
    )

    return ValidationOutcome(report=report, gaps=gaps, agent_report=agent_report)


def build_mass_balance_retry_feedback(report: ValidationReport) -> str:
    """Build extractor correction hint when mass balance validation fails."""
    total = report.mass_balance_total_percent
    total_hint = f" Parsed sum: {total}%." if total is not None else ""
    issue_text = "; ".join(report.issues) if report.issues else "Composition does not sum to 100%."
    return (
        "CORRECTION REQUIRED — previous extraction failed mass balance validation."
        f"{total_hint} {issue_text} "
        "Re-scan SDS Section 3 / material composition. Use range midpoints for bands "
        "(e.g. 40-60% → 50%). Ensure sustainability.material_composition percentages "
        "sum to exactly 100%. If declared substances are below 100%, add "
        "'Nicht deklarationspflichtige Stoffe / Füllstoffe' for the remainder. "
        "If the sum exceeds 100%, scale proportionally or remove duplicate entries."
    )
