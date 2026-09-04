"""Validation node (mass balance + completeness)."""

from __future__ import annotations

from typing import Any

from etl.graph.coerce_state import coerce_extracted_data
from etl.graph.state import DppGraphState, ValidationStatus
from etl.services.validation import build_mass_balance_retry_feedback, validate_extracted_data


async def validator_node(state: DppGraphState) -> dict[str, Any]:
    extracted_data = coerce_extracted_data(state.get("extracted_data"))
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
