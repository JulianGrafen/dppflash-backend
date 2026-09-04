"""LLM extraction node."""

from __future__ import annotations

import asyncio
import base64
import logging
import os
from typing import Any

from etl.graph.coerce_state import coerce_raw_document
from etl.graph.state import (
    clamp_max_extraction_attempts,
    DppGraphState,
    EnrichmentStage,
    RawDocumentInput,
    ValidationStatus,
)
from etl.models.dpp_schemas import DPPAnalysisResult
from etl.services.dpp_extractor import DPPExtractor, ExtractorConfig, LLMExtractionError, PDFReadError
from etl.services.env_loader import describe_missing_llm_config, load_project_env, resolve_openai_api_key

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


async def extractor_node(state: DppGraphState) -> dict[str, Any]:
    raw_document = coerce_raw_document(state.get("raw_document"))
    if raw_document is None:
        return {"errors": ["extractor_node: raw_document is missing from state."]}

    attempt = (state.get("extraction_attempt") or 0) + 1
    retry_feedback = state.get("retry_feedback")
    max_attempts = clamp_max_extraction_attempts(state.get("max_extraction_attempts"))

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
            "max_extraction_attempts": max_attempts,
            "errors": [f"extractor_node: {exc}"],
        }
