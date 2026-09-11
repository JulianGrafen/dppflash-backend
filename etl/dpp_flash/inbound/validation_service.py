"""Inbound validation — bridge ProductPassportDraft to ESPR validator + auditor."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal, TYPE_CHECKING

from pydantic import BaseModel

from etl.dpp_flash.inbound.draft_to_analysis import resolve_analysis_for_validation
from etl.dpp_flash.inbound.models import ProductPassportDraft
from etl.graph.state import GapRecord, ValidationStatus
from etl.models.dpp_schemas import DPPAnalysisResult
from etl.services.espr_auditor import run_espr_audit
from etl.services.validation import validate_extracted_data

if TYPE_CHECKING:
    from etl.dpp_flash.inbound.repository import DppDraftRepository

InboundValidationStatus = Literal["pending", "valid", "invalid"]


class InboundValidationResult(BaseModel):
    validation_status: InboundValidationStatus
    readiness_score_percent: float
    gap_count: int
    gaps: list[GapRecord]
    validation_report: dict[str, Any]
    audit_report: dict[str, Any]
    plausibility_report: dict[str, Any]
    validated_at: str


def _merge_gaps(*gap_lists: list[GapRecord]) -> list[GapRecord]:
    seen: set[str] = set()
    merged: list[GapRecord] = []
    for gap_list in gap_lists:
        for gap in gap_list:
            if gap.field_path in seen:
                continue
            seen.add(gap.field_path)
            merged.append(gap)
    return merged


def _build_validation_result(analysis: DPPAnalysisResult) -> InboundValidationResult:
    """Run validator + auditor on a resolved analysis payload."""
    outcome = validate_extracted_data(analysis)
    audit = run_espr_audit(analysis)

    gaps = _merge_gaps(outcome.gaps, audit.gaps)
    readiness = float(outcome.report.readiness_score_percent)
    is_valid = (
        outcome.report.status == ValidationStatus.VALID
        and audit.report.is_fully_compliant
    )
    status: InboundValidationStatus = "valid" if is_valid else "invalid"

    return InboundValidationResult(
        validation_status=status,
        readiness_score_percent=readiness,
        gap_count=len(gaps),
        gaps=gaps,
        validation_report=outcome.report.model_dump(mode="json"),
        audit_report=audit.report.model_dump(mode="json"),
        plausibility_report=outcome.agent_report.model_dump(mode="json"),
        validated_at=datetime.now(timezone.utc).isoformat(),
    )


def validate_passport_draft(
    draft: ProductPassportDraft,
    raw_extraction: dict[str, Any] | None = None,
) -> tuple[InboundValidationResult, DPPAnalysisResult]:
    """Run deterministic ESPR validation + audit on an inbound draft."""
    analysis = resolve_analysis_for_validation(draft, raw_extraction)
    return _build_validation_result(analysis), analysis


def validation_fields_for_row(
    result: InboundValidationResult,
    analysis: DPPAnalysisResult,
) -> dict[str, Any]:
    """Persistence columns for product_passports."""
    gap_analysis = analysis.calculate_gap_analysis()
    return {
        "validation_status": result.validation_status,
        "readiness_score_percent": result.readiness_score_percent,
        "validation_report": {
            "validation": result.validation_report,
            "plausibility": result.plausibility_report,
            "audit": result.audit_report,
            "analysis_snapshot": analysis.model_dump(mode="json"),
            "filled_field_paths": gap_analysis["filled_field_names"],
            "total_field_paths": gap_analysis["total_fields"],
        },
        "gaps": [gap.model_dump(mode="json") for gap in result.gaps],
        "validated_at": result.validated_at,
    }


def apply_validation_to_row(
    row: dict[str, Any],
    draft: ProductPassportDraft,
    *,
    raw_extraction: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Validate draft and merge validation fields into a persistence row."""
    result, analysis = validate_passport_draft(draft, raw_extraction)
    updated = dict(row)
    updated.update(validation_fields_for_row(result, analysis))
    updated["is_draft"] = result.validation_status != "valid"
    return updated


def persist_with_validation(
    repository: "DppDraftRepository",
    row: dict[str, Any],
    draft: ProductPassportDraft,
    *,
    raw_extraction: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], InboundValidationResult]:
    """Validate draft, persist row, return stored row + validation result."""
    tenant_id = str(row.get("tenant_id") or "").strip()
    if tenant_id:
        from etl.dpp_flash.inbound.stammdaten_repository import get_tenant_stammdaten_repository
        from etl.dpp_flash.inbound.stammdaten_service import apply_tenant_stammdaten_to_draft

        draft = apply_tenant_stammdaten_to_draft(
            draft,
            tenant_id,
            get_tenant_stammdaten_repository(),
        )
        row = dict(row)
        row["payload"] = draft.model_dump(mode="json")
    result, analysis = validate_passport_draft(draft, raw_extraction)
    validated_row = dict(row)
    validated_row.update(validation_fields_for_row(result, analysis))
    validated_row["is_draft"] = result.validation_status != "valid"
    stored = repository.upsert_row(validated_row)
    return stored, result
