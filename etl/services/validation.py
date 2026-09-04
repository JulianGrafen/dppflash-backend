"""
Deterministic validation for extracted DPP payloads.

Checks
------
1. ESPR field completeness (via `DPPAnalysisResult.calculate_gap_analysis()`).
2. Material mass-balance when percentage patterns are present in the composition text.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from etl.graph.state import GapRecord, ValidationReport, ValidationStatus
from etl.models.audit_field import AuditField, audit_text, audit_value
from etl.models.dpp_schemas import DPPAnalysisResult

_COMPOSITION_PERCENT_PATTERN = re.compile(
    r"(?P<label>[^;\n%]+?)\s*(?:[:=]?\s*)?(?P<value>\d{1,3}(?:[.,]\d+)?)\s*%",
    re.IGNORECASE,
)
_MASS_BALANCE_TOLERANCE = 0.5
_MIN_READINESS_FOR_VALID = 100.0


@dataclass(frozen=True)
class ValidationOutcome:
    report: ValidationReport
    gaps: list[GapRecord]


def _extract_percentages_from_composition_text(text: str | None) -> list[float]:
    if not text:
        return []
    values: list[float] = []
    for match in _COMPOSITION_PERCENT_PATTERN.finditer(text):
        raw = match.group("value").replace(",", ".")
        try:
            values.append(float(raw))
        except ValueError:
            continue
    return values


def _evaluate_mass_balance(result: DPPAnalysisResult) -> tuple[bool, float | None, list[str]]:
    composition_text = None
    if result.sustainability is not None:
        composition_text = audit_text(result.sustainability.material_composition)

    percentages = _extract_percentages_from_composition_text(composition_text)
    if not percentages:
        return True, None, []

    total = round(sum(percentages), 2)
    issues: list[str] = []
    if abs(total - 100.0) > _MASS_BALANCE_TOLERANCE:
        issues.append(
            f"Mass balance deviation: parsed composition percentages sum to {total}% "
            f"(expected 100% ± {_MASS_BALANCE_TOLERANCE})."
        )
        return False, total, issues

    return True, total, []


def validate_extracted_data(result: DPPAnalysisResult) -> ValidationOutcome:
    """
    Validate extracted DPP data and derive gap records for downstream remediation.
    """
    gap_analysis = result.calculate_gap_analysis()
    missing_paths: list[str] = list(gap_analysis["missing_fields"])
    readiness = float(gap_analysis["score_percent"])

    mass_balance_ok, mass_total, mass_issues = _evaluate_mass_balance(result)
    issues = list(mass_issues)

    gaps: list[GapRecord] = [
        GapRecord(
            field_path=path,
            reason="Required ESPR field is empty or missing in the extraction result.",
            severity="major",
        )
        for path in missing_paths
    ]

    if not mass_balance_ok:
        gaps.append(
            GapRecord(
                field_path="sustainability.material_composition",
                reason=issues[-1],
                severity="critical",
            )
        )

    is_complete = len(missing_paths) == 0 and mass_balance_ok and readiness >= _MIN_READINESS_FOR_VALID
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

    return ValidationOutcome(report=report, gaps=gaps)


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

