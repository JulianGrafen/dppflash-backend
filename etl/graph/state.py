"""
LangGraph state definition — single source of truth for the DPP extraction pipeline.
"""

from __future__ import annotations

from enum import Enum
from typing import Annotated, Any, Literal, TypedDict

from pydantic import BaseModel, Field

from etl.models.dpp_schemas import DPPAnalysisResult


class ValidationStatus(str, Enum):
    """Outcome of the mass-balance / field validator node."""

    PENDING = "pending"
    VALID = "valid"
    INVALID = "invalid"


class ComplianceStatus(str, Enum):
    """Lifecycle status persisted in the central DB (Flowchart: HITL Dashboard)."""

    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"


class EnrichmentStage(str, Enum):
    """Current gap-enrichment stage (Flowchart: Stufe 1 / Stufe 2 / Eskalation)."""

    NONE = "none"
    API_LOOKUP = "api_lookup"
    SUPPLIER_OUTREACH = "supplier_outreach"
    ESCALATED = "escalated"


class RawDocumentInput(BaseModel):
    """JSON-serialisable document payload (LangGraph Studio friendly)."""

    filename: str = Field(default="document.pdf")
    document_text: str | None = Field(default=None)
    pdf_base64: str | None = Field(default=None)
    product_type_hint: str | None = Field(default=None)


class SkuMasterData(BaseModel):
    """WWS/ERP master data handoff (Flowchart: CSV/SKU Input)."""

    sku: str | None = None
    gtin: str | None = None
    product_name: str | None = None
    manufacturer_name: str | None = None
    taric_code: str | None = None


class GapRecord(BaseModel):
    """One ESPR data gap detected by validator or auditor."""

    field_path: str
    reason: str
    severity: Literal["critical", "major", "minor"] = "major"


class GapRemediationPlan(BaseModel):
    """Structured gap summary for compliance auditors."""

    product_identifier: str | None = None
    gap_count: int = 0
    gaps: list[GapRecord] = Field(default_factory=list)
    recommended_actions: list[str] = Field(default_factory=list)


DEFAULT_MAX_EXTRACTION_ATTEMPTS = 3


class ValidationReport(BaseModel):
    """Mass-balance + field completeness check after extraction."""

    status: ValidationStatus = ValidationStatus.PENDING
    is_complete: bool = False
    mass_balance_ok: bool = True
    mass_balance_total_percent: float | None = None
    readiness_score_percent: float = 0.0
    missing_field_paths: list[str] = Field(default_factory=list)
    issues: list[str] = Field(default_factory=list)


class EspAuditReport(BaseModel):
    """ESPR Auditor Agent output (CO₂ mapping + schema validation)."""

    is_fully_compliant: bool = False
    readiness_score_percent: float = 0.0
    schema_valid: bool = True
    co2_mapping_applied: bool = False
    co2_notes: str | None = None
    missing_field_paths: list[str] = Field(default_factory=list)
    gaps: list[GapRecord] = Field(default_factory=list)
    issues: list[str] = Field(default_factory=list)


class EnrichmentAttemptResult(BaseModel):
    """Result of one gap-enrichment stage (API or supplier outreach)."""

    stage: EnrichmentStage
    success: bool = False
    filled_field_paths: list[str] = Field(default_factory=list)
    remaining_gaps: list[GapRecord] = Field(default_factory=list)
    notes: str | None = None


class DbPersistResult(BaseModel):
    """Outcome of writing to the central DB (Single Source of Truth)."""

    record_id: str
    compliance_status: ComplianceStatus
    persisted_at: str
    notes: str | None = None


def merge_errors(left: list[str] | None, right: list[str] | None) -> list[str]:
    merged = list(left or [])
    for item in right or []:
        if item not in merged:
            merged.append(item)
    return merged


class DppGraphState(TypedDict, total=False):
    """Central LangGraph state — maps 1:1 to the enterprise flowchart."""

    raw_document: RawDocumentInput
    sku_master_data: SkuMasterData | None
    extracted_data: DPPAnalysisResult | None
    validation_status: ValidationStatus
    validation_report: ValidationReport | None
    espr_audit_report: EspAuditReport | None
    gaps: list[GapRecord]
    gap_remediation: GapRemediationPlan | None
    enrichment_stage: EnrichmentStage
    enrichment_result: EnrichmentAttemptResult | None
    compliance_status: ComplianceStatus
    db_persist_result: DbPersistResult | None
    extraction_attempt: int
    max_extraction_attempts: int
    retry_feedback: str | None
    errors: Annotated[list[str], merge_errors]
    metadata: dict[str, Any]
