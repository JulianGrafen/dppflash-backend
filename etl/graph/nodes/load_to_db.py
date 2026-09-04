"""Persist to central DB node."""

from __future__ import annotations

from typing import Any

from etl.graph.coerce_state import coerce_espr_audit_report, coerce_extracted_data
from etl.graph.state import ComplianceStatus, DppGraphState
from etl.services.enrichment import persist_to_central_db


async def load_to_db_node(state: DppGraphState) -> dict[str, Any]:
    audit = coerce_espr_audit_report(state.get("espr_audit_report"))
    compliance_status = state.get("compliance_status", ComplianceStatus.DRAFT)

    if audit is not None and audit.is_fully_compliant:
        compliance_status = ComplianceStatus.APPROVED
    elif compliance_status != ComplianceStatus.PENDING_REVIEW:
        compliance_status = ComplianceStatus.DRAFT

    persist_result = persist_to_central_db(
        extracted_data=coerce_extracted_data(state.get("extracted_data")),
        compliance_status=compliance_status,
        metadata=state.get("metadata"),
    )

    return {
        "compliance_status": compliance_status,
        "db_persist_result": persist_result,
    }
