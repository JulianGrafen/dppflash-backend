"""ESPR compliance audit node."""

from __future__ import annotations

from typing import Any

from etl.graph.coerce_state import coerce_extracted_data
from etl.graph.state import ComplianceStatus, DppGraphState
from etl.services.espr_auditor import run_espr_audit
from etl.services.gap_management import build_gap_remediation_plan


async def espr_auditor_node(state: DppGraphState) -> dict[str, Any]:
    extracted_data = coerce_extracted_data(state.get("extracted_data"))
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
