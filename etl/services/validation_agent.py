"""
Deterministic Validation Agent — plausibility and cross-field sense checks.

Runs after structured extraction; no LLM. Findings feed inbound gaps and auditor UI.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Callable, Literal

from pydantic import BaseModel, Field

from etl.models.audit_field import audit_text
from etl.models.dpp_schemas import DPPAnalysisResult, ProductCategory, TextileProductDetails
from etl.services.composition_parse import extract_percentages_from_text

PlausibilitySeverity = Literal["critical", "major", "warning"]

_MASS_BALANCE_TOLERANCE = 0.5
_GTIN_SKIP_TOKENS = frozenset(
    {"PENDING_EXTERNAL_MATCH", "PENDING", "N/A", "NA", "UNKNOWN", "TBD"}
)
_EMAIL_LIKE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", re.IGNORECASE)
_EMAIL_LOOSE = re.compile(r"@", re.IGNORECASE)


class PlausibilityFinding(BaseModel):
    rule_id: str
    field_path: str
    message: str
    severity: PlausibilitySeverity = "major"


class ValidationAgentReport(BaseModel):
    passed: bool = True
    findings: list[PlausibilityFinding] = Field(default_factory=list)
    mass_balance_total_percent: float | None = None
    gtin_checked: bool = False
    gtin_valid: bool | None = None


@dataclass(frozen=True)
class ValidationAgentOutcome:
    report: ValidationAgentReport
    gaps_field_paths: list[str]


def _gtin_digits_only(raw: str) -> str:
    return "".join(ch for ch in raw if ch.isdigit())


def _gtin_check_digit_valid(digits: str) -> bool:
    if len(digits) not in (8, 12, 13, 14):
        return False
    body = digits[:-1]
    expected_check = int(digits[-1])
    total = 0
    for index, ch in enumerate(reversed(body)):
        value = int(ch)
        total += value * 3 if index % 2 == 0 else value
    calculated = (10 - (total % 10)) % 10
    return calculated == expected_check


def _rule_mass_balance(result: DPPAnalysisResult) -> tuple[list[PlausibilityFinding], float | None]:
    composition_text = None
    if result.sustainability is not None:
        composition_text = audit_text(result.sustainability.material_composition)

    percentages = extract_percentages_from_text(composition_text)
    if not percentages:
        return [], None

    total = round(sum(percentages), 2)
    if abs(total - 100.0) <= _MASS_BALANCE_TOLERANCE:
        return [], total

    message = (
        f"Mass balance deviation: parsed composition percentages sum to {total}% "
        f"(expected 100% ± {_MASS_BALANCE_TOLERANCE})."
    )
    return [
        PlausibilityFinding(
            rule_id="mass_balance",
            field_path="sustainability.material_composition",
            message=message,
            severity="critical",
        )
    ], total


def _rule_gtin_checksum(result: DPPAnalysisResult) -> list[PlausibilityFinding]:
    if result.identification is None:
        return []
    raw = audit_text(result.identification.gtin_or_equivalent)
    if not raw:
        return []
    normalized = raw.strip().upper()
    if normalized in _GTIN_SKIP_TOKENS or "PENDING" in normalized:
        return []

    digits = _gtin_digits_only(raw)
    if not digits or len(digits) not in (8, 12, 13, 14):
        return []

    if _gtin_check_digit_valid(digits):
        return []

    return [
        PlausibilityFinding(
            rule_id="gtin_checksum",
            field_path="identification.gtin_or_equivalent",
            message=f"GTIN/EAN check digit invalid for '{raw}' (GS1 mod-10).",
            severity="major",
        )
    ]


def _rule_recycled_percent_bounds(result: DPPAnalysisResult) -> list[PlausibilityFinding]:
    findings: list[PlausibilityFinding] = []
    texts: list[tuple[str, str]] = []

    if result.sustainability is not None:
        comp = audit_text(result.sustainability.material_composition)
        if comp:
            texts.append(("sustainability.material_composition", comp))

    if result.product_details is not None and result.product_category == ProductCategory.TEXTILES_APPAREL:
        if isinstance(result.product_details, TextileProductDetails):
            recycled = audit_text(result.product_details.recycled_content_by_material)
            if recycled:
                texts.append(("product_details.recycled_content_by_material", recycled))

    for field_path, text in texts:
        for value in extract_percentages_from_text(text):
            if value <= 0:
                findings.append(
                    PlausibilityFinding(
                        rule_id="recycled_percent_bounds",
                        field_path=field_path,
                        message=f"Parsed percentage {value}% is not in range (0, 100].",
                        severity="warning",
                    )
                )
            elif value > 100.0:
                findings.append(
                    PlausibilityFinding(
                        rule_id="recycled_percent_bounds",
                        field_path=field_path,
                        message=f"Parsed percentage {value}% exceeds 100%.",
                        severity="major",
                    )
                )
    return findings


def _rule_recycled_not_additive(result: DPPAnalysisResult) -> list[PlausibilityFinding]:
    if result.sustainability is None or result.product_details is None:
        return []
    if result.product_category != ProductCategory.TEXTILES_APPAREL:
        return []
    if not isinstance(result.product_details, TextileProductDetails):
        return []

    composition = audit_text(result.sustainability.material_composition)
    recycled = audit_text(result.product_details.recycled_content_by_material)
    if not composition or not recycled:
        return []

    recycled_values = extract_percentages_from_text(recycled)
    if not recycled_values:
        return []

    total_recycled = round(sum(recycled_values), 2)
    if total_recycled <= 100.0:
        return []

    return [
        PlausibilityFinding(
            rule_id="recycled_not_additive",
            field_path="product_details.recycled_content_by_material",
            message=(
                f"Recycled-content percentages sum to {total_recycled}% — "
                "recycled shares must not be added on top of a separate 100% composition total."
            ),
            severity="warning",
        )
    ]


def _rule_contact_email_shape(result: DPPAnalysisResult) -> list[PlausibilityFinding]:
    if result.economic_operator is None:
        return []
    contact = audit_text(result.economic_operator.electronic_contact_details)
    if not contact:
        return []
    if not _EMAIL_LOOSE.search(contact):
        return []
    if _EMAIL_LIKE.match(contact.strip()):
        return []

    return [
        PlausibilityFinding(
            rule_id="contact_email_shape",
            field_path="economic_operator.electronic_contact_details",
            message=f"Contact value looks like an email but failed basic format check: '{contact}'.",
            severity="warning",
        )
    ]


_EXTRA_RULES: list[Callable[[DPPAnalysisResult], list[PlausibilityFinding]]] = [
    _rule_recycled_percent_bounds,
    _rule_recycled_not_additive,
    _rule_contact_email_shape,
]


def run_validation_agent(result: DPPAnalysisResult) -> ValidationAgentOutcome:
    """Run all plausibility rules; failed if any critical or major finding."""
    findings: list[PlausibilityFinding] = []
    mass_total: float | None = None
    gtin_checked = False
    gtin_valid: bool | None = None

    mass_findings, mass_total = _rule_mass_balance(result)
    findings.extend(mass_findings)

    gtin_findings = _rule_gtin_checksum(result)
    findings.extend(gtin_findings)
    if result.identification is not None:
        raw_gtin = audit_text(result.identification.gtin_or_equivalent)
        if raw_gtin:
            digits = _gtin_digits_only(raw_gtin)
            if digits and len(digits) in (8, 12, 13, 14):
                normalized = raw_gtin.strip().upper()
                if normalized not in _GTIN_SKIP_TOKENS and "PENDING" not in normalized:
                    gtin_checked = True
                    gtin_valid = len(gtin_findings) == 0

    for rule in _EXTRA_RULES:
        findings.extend(rule(result))

    blocking = [f for f in findings if f.severity in ("critical", "major")]
    passed = len(blocking) == 0

    report = ValidationAgentReport(
        passed=passed,
        findings=findings,
        mass_balance_total_percent=mass_total,
        gtin_checked=gtin_checked,
        gtin_valid=gtin_valid,
    )
    gap_paths = list({f.field_path for f in blocking})
    return ValidationAgentOutcome(report=report, gaps_field_paths=gap_paths)
