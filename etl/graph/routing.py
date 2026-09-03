"""
Conditional routing — maps flowchart decision diamonds to graph edges.
"""

from __future__ import annotations

from typing import Literal

from etl.graph.coerce_state import coerce_espr_audit_report, coerce_validation_report
from etl.graph.state import DEFAULT_MAX_EXTRACTION_ATTEMPTS, DppGraphState

AfterValidationRoute = Literal["extractor", "espr_auditor", "api_enrichment"]
AfterEspAuditRoute = Literal["load_to_db", "api_enrichment"]
AfterApiEnrichmentRoute = Literal["load_to_db", "supplier_outreach"]
AfterSupplierOutreachRoute = Literal["load_to_db", "escalate"]


def route_after_validation(state: DppGraphState) -> AfterValidationRoute:
    """
    Decision 1 — Massenbilanz = 100%?

    - NEIN + Retries übrig  → extractor (Self-reflection Loop)
    - JA                    → espr_auditor
    - NEIN + Retries erschöpft → api_enrichment (Gap-Fill Stufe 1)
    """
    validation_report = coerce_validation_report(state.get("validation_report"))
    if validation_report is None or not validation_report.mass_balance_ok:
        attempt = state.get("extraction_attempt", 0)
        max_attempts = state.get("max_extraction_attempts", DEFAULT_MAX_EXTRACTION_ATTEMPTS)
        if attempt < max_attempts:
            return "extractor"
        return "api_enrichment"

    return "espr_auditor"


def route_after_espr_audit(state: DppGraphState) -> AfterEspAuditRoute:
    """
    Decision 2 — Datenqualität & Vollständigkeit OK?

    - JA, 100% konform → load_to_db
    - NEIN             → api_enrichment (Stufe 1)
    """
    audit_report = coerce_espr_audit_report(state.get("espr_audit_report"))
    if audit_report is not None and audit_report.is_fully_compliant:
        return "load_to_db"
    return "api_enrichment"


def route_after_api_enrichment(state: DppGraphState) -> AfterApiEnrichmentRoute:
    """
    Decision 3 — Daten gefunden? (SPHIER/EPRM API)

    - JA  → load_to_db
    - NEIN → supplier_outreach (Stufe 2)
    """
    enrichment = state.get("enrichment_result")
    gaps = state.get("gaps") or []

    if enrichment is not None and enrichment.success and not enrichment.remaining_gaps:
        return "load_to_db"

    if not gaps:
        return "load_to_db"

    return "supplier_outreach"


def route_after_supplier_outreach(state: DppGraphState) -> AfterSupplierOutreachRoute:
    """
    Decision 4 — Supplier Response?

    - JA  → load_to_db
    - NEIN → escalate (Pending Review)
    """
    enrichment = state.get("enrichment_result")
    if enrichment is not None and enrichment.success:
        return "load_to_db"
    return "escalate"
