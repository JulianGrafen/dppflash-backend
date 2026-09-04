"""Combined extract + validate phase with in-node retry (no graph cycle)."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from etl.graph.coerce_state import coerce_raw_document
from etl.graph.nodes.extractor import _run_extraction
from etl.graph.state import (
    clamp_max_extraction_attempts,
    DppGraphState,
    EnrichmentStage,
    ValidationStatus,
)
from etl.services.dpp_extractor import LLMExtractionError, PDFReadError
from etl.services.validation import build_mass_balance_retry_feedback, validate_extracted_data

logger = logging.getLogger(__name__)


async def extraction_phase_node(state: DppGraphState) -> dict[str, Any]:
    """
    Run LLM extraction and mass-balance validation in one node.

    Retries happen inside this node so the graph never loops extractor↔validator
    (which can hit LangGraph recursion limits when Studio sets a high retry count).
    """
    raw_document = coerce_raw_document(state.get("raw_document"))
    if raw_document is None:
        return {"errors": ["extraction_phase_node: raw_document is missing from state."]}

    max_attempts = clamp_max_extraction_attempts(state.get("max_extraction_attempts"))
    retry_feedback = state.get("retry_feedback")
    metadata = dict(state.get("metadata") or {})

    last_payload: dict[str, Any] | None = None

    for attempt in range(1, max_attempts + 1):
        try:
            extracted_data = await asyncio.to_thread(
                _run_extraction,
                raw_document,
                correction_hints=retry_feedback,
            )
        except (PDFReadError, LLMExtractionError) as exc:
            logger.exception("graph.extraction_phase.failed")
            return {
                "extracted_data": None,
                "validation_status": ValidationStatus.INVALID,
                "validation_report": None,
                "gaps": state.get("gaps") or [],
                "extraction_attempt": attempt,
                "max_extraction_attempts": max_attempts,
                "retry_feedback": None,
                "enrichment_stage": EnrichmentStage.NONE,
                "errors": [f"extraction_phase_node: {exc}"],
                "metadata": {
                    **metadata,
                    "source_filename": raw_document.filename,
                    "last_extraction_attempt": attempt,
                },
            }

        outcome = validate_extracted_data(extracted_data)
        retry_feedback = (
            build_mass_balance_retry_feedback(outcome.report)
            if not outcome.report.mass_balance_ok
            else None
        )

        last_payload = {
            "extracted_data": extracted_data,
            "validation_status": outcome.report.status,
            "validation_report": outcome.report,
            "gaps": outcome.gaps,
            "extraction_attempt": attempt,
            "max_extraction_attempts": max_attempts,
            "retry_feedback": None,
            "enrichment_stage": EnrichmentStage.NONE,
            "metadata": {
                **metadata,
                "source_filename": raw_document.filename,
                "last_extraction_attempt": attempt,
            },
        }

        if outcome.report.mass_balance_ok:
            logger.info(
                "extraction_phase_node: mass balance OK on attempt %s/%s",
                attempt,
                max_attempts,
            )
            return last_payload

        logger.info(
            "extraction_phase_node: mass balance failed on attempt %s/%s — retrying",
            attempt,
            max_attempts,
        )

    assert last_payload is not None
    logger.warning(
        "extraction_phase_node: mass balance still failing after %s attempts — continuing pipeline",
        max_attempts,
    )
    return last_payload
