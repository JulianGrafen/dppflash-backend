"""Manual escalation node."""

from __future__ import annotations

from typing import Any

from etl.graph.coerce_state import coerce_extracted_data, coerce_gaps
from etl.graph.state import ComplianceStatus, DppGraphState, EnrichmentStage
from etl.services.gap_management import build_gap_remediation_plan


async def escalate_node(state: DppGraphState) -> dict[str, Any]:
    gaps = coerce_gaps(state.get("gaps"))
    return {
        "enrichment_stage": EnrichmentStage.ESCALATED,
        "compliance_status": ComplianceStatus.PENDING_REVIEW,
        "gap_remediation": build_gap_remediation_plan(gaps, coerce_extracted_data(state.get("extracted_data"))),
    }
