"""
LangGraph node implementations for the DPP extraction pipeline.
"""

from __future__ import annotations

import asyncio
import base64
import logging
import os
from typing import Any

from etl.graph.state import (
    DEFAULT_MAX_EXTRACTION_ATTEMPTS,
    ComplianceStatus,
    DppGraphState,
    EnrichmentStage,
    RawDocumentInput,
    ValidationStatus,
)
from etl.models.dpp_schemas import DPPAnalysisResult
from etl.services.dpp_extractor import DPPExtractor, ExtractorConfig, LLMExtractionError, PDFReadError
from etl.services.enrichment import (
    lookup_sphier_eprm_api,
    persist_to_central_db,
    send_supplier_outreach,
)
from etl.services.espr_auditor import run_espr_audit
from etl.services.env_loader import describe_missing_llm_config, load_project_env, resolve_openai_api_key
from etl.services.validation import build_mass_balance_retry_feedback, validate_extracted_data

logger = logging.getLogger(__name__)


def _build_extractor() -> DPPExtractor:
    load_project_env()
    api_key = resolve_openai_api_key()
    if not api_key:
        raise LLMExtractionError(describe_missing_llm_config())

    config = ExtractorConfig(
        openai_api_key=api_key,
        model=os.environ.get("DPP_EXTRACTOR_MODEL", "gpt-4o-2024-08-06"),
        timeout_seconds=float(os.environ.get("DPP_EXTRACTOR_TIMEOUT_SECONDS", "120")),
    )
    return DPPExtractor(config)


def _run_extraction(
    raw_document: RawDocumentInput,
    *,
    correction_hints: str | None = None,
) -> DPPAnalysisResult:
    extractor = _build_extractor()

    if raw_document.document_text:
        return extractor.extract_from_text(
            raw_document.document_text,
            filename=raw_document.filename,
            correction_hints=correction_hints,
        )

    if raw_document.pdf_base64:
        pdf_bytes = base64.b64decode(raw_document.pdf_base64)
        return extractor.extract(
            pdf_bytes,
            filename=raw_document.filename,
            correction_hints=correction_hints,
        )

    raise PDFReadError(
        "raw_document must include either `document_text` or `pdf_base64` for extraction."
    )


def _resolve_product_identifier(state: DppGraphState) -> str | None:
    extracted = state.get("extracted_data")
    if extracted and extracted.identification:
        for value in (
            extracted.identification.unique_product_identifier,
            extracted.identification.gtin_or_equivalent,
        ):
            if isinstance(value, str) and value.strip():
                return value.strip()
    master = state.get("sku_master_data")
    if master and master.product_name:
        return master.product_name
    return None


async def extractor_node(state: DppGraphState) -> dict[str, Any]:
    raw_document = state.get("raw_document")
    if raw_document is None:
        return {"errors": ["extractor_node: raw_document is missing from state."]}

    attempt = (state.get("extraction_attempt") or 0) + 1
    retry_feedback = state.get("retry_feedback")
    max_attempts = state.get("max_extraction_attempts", DEFAULT_MAX_EXTRACTION_ATTEMPTS)

    try:
        extracted_data = await asyncio.to_thread(
            _run_extraction,
            raw_document,
            correction_hints=retry_feedback,
        )
        return {
            "extracted_data": extracted_data,
            "validation_status": ValidationStatus.PENDING,
            "gaps": [],
            "extraction_attempt": attempt,
            "max_extraction_attempts": max_attempts,
            "retry_feedback": None,
            "enrichment_stage": EnrichmentStage.NONE,
            "metadata": {
                **(state.get("metadata") or {}),
                "source_filename": raw_document.filename,
                "last_extraction_attempt": attempt,
            },
        }
    except (PDFReadError, LLMExtractionError) as exc:
        logger.exception("graph.extractor.failed")
        return {
            "extracted_data": None,
            "validation_status": ValidationStatus.INVALID,
            "extraction_attempt": attempt,
            "errors": [f"extractor_node: {exc}"],
        }


async def validator_node(state: DppGraphState) -> dict[str, Any]:
    extracted_data = state.get("extracted_data")
    if extracted_data is None:
        return {
            "validation_status": ValidationStatus.INVALID,
            "validation_report": None,
            "gaps": state.get("gaps") or [],
            "retry_feedback": None,
            "errors": ["validator_node: extracted_data is missing — extraction failed."],
        }

    outcome = validate_extracted_data(extracted_data)
    retry_feedback = (
        build_mass_balance_retry_feedback(outcome.report)
        if not outcome.report.mass_balance_ok
        else None
    )

    return {
        "validation_status": outcome.report.status,
        "validation_report": outcome.report,
        "gaps": outcome.gaps,
        "retry_feedback": retry_feedback,
    }


async def espr_auditor_node(state: DppGraphState) -> dict[str, Any]:
    extracted_data = state.get("extracted_data")
    if extracted_data is None:
        return {"errors": ["espr_auditor_node: extracted_data is missing."]}

    outcome = run_espr_audit(extracted_data)
    compliance_status = (
        ComplianceStatus.APPROVED
        if outcome.report.is_fully_compliant
        else ComplianceStatus.DRAFT
    )

    return {
        "espr_audit_report": outcome.report,
        "gaps": outcome.gaps,
        "compliance_status": compliance_status,
        "gap_remediation": build_gap_remediation_plan(outcome.gaps, extracted_data),
    }


async def api_enrichment_node(state: DppGraphState) -> dict[str, Any]:
    extracted_data = state.get("extracted_data")
    gaps = state.get("gaps") or []

    if extracted_data is None:
        return {"errors": ["api_enrichment_node: extracted_data is missing."]}

    result = lookup_sphier_eprm_api(
        extracted_data=extracted_data,
        gaps=gaps,
        sku_master_data=state.get("sku_master_data"),
    )

    return {
        "enrichment_stage": EnrichmentStage.API_LOOKUP,
        "enrichment_result": result,
        "gaps": result.remaining_gaps,
        "extracted_data": extracted_data,
    }


async def supplier_outreach_node(state: DppGraphState) -> dict[str, Any]:
    extracted_data = state.get("extracted_data")
    gaps = state.get("gaps") or []

    if extracted_data is None:
        return {"errors": ["supplier_outreach_node: extracted_data is missing."]}

    result = send_supplier_outreach(
        extracted_data=extracted_data,
        gaps=gaps,
        product_identifier=_resolve_product_identifier(state),
    )

    return {
        "enrichment_stage": EnrichmentStage.SUPPLIER_OUTREACH,
        "enrichment_result": result,
        "gaps": result.remaining_gaps,
        "extracted_data": extracted_data,
    }


async def escalate_node(state: DppGraphState) -> dict[str, Any]:
    gaps = state.get("gaps") or []
    return {
        "enrichment_stage": EnrichmentStage.ESCALATED,
        "compliance_status": ComplianceStatus.PENDING_REVIEW,
        "gap_remediation": build_gap_remediation_plan(gaps, state.get("extracted_data")),
    }


async def load_to_db_node(state: DppGraphState) -> dict[str, Any]:
    audit = state.get("espr_audit_report")
    compliance_status = state.get("compliance_status", ComplianceStatus.DRAFT)

    if audit is not None and audit.is_fully_compliant:
        compliance_status = ComplianceStatus.APPROVED
    elif compliance_status != ComplianceStatus.PENDING_REVIEW:
        compliance_status = ComplianceStatus.DRAFT

    persist_result = persist_to_central_db(
        extracted_data=state.get("extracted_data"),
        compliance_status=compliance_status,
        metadata=state.get("metadata"),
    )

    return {
        "compliance_status": compliance_status,
        "db_persist_result": persist_result,
    }
