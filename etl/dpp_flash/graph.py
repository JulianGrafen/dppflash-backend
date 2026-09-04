"""
DPP-Flash LangGraph assembly — regulatory validation & supplier escalation scaffold.
"""

from __future__ import annotations

from typing import Literal

from langgraph.graph import END, START, StateGraph

from etl.dpp_flash.nodes import (
    extractor_node,
    human_escalation_node,
    sap_enrichment_node,
    supplier_outreach_node,
    validator_node,
)
from etl.dpp_flash.state import DPPState, ESCALATION_RETRY_LIMIT, STATUS_REQUIRES_HUMAN_INTERVENTION

AfterValidationRoute = Literal["end", "sap_enrichment"]
AfterSapEnrichmentRoute = Literal["supplier_outreach", "human_escalation"]


def route_after_validation(state: DPPState) -> AfterValidationRoute:
    """Route to END when compliant, otherwise start SAP gap enrichment."""
    if state.get("is_valid"):
        return "end"
    return "sap_enrichment"


def route_after_sap_enrichment(state: DPPState) -> AfterSapEnrichmentRoute:
    """
    Route to supplier outreach when SAP returns an e-mail.

    Escalate to human review when:
    - ``status`` is ``REQUIRES_HUMAN_INTERVENTION`` (SAP cascade exhausted), OR
    - retry budget is already exhausted (>= 3).
    """
    if state.get("status") == STATUS_REQUIRES_HUMAN_INTERVENTION:
        return "human_escalation"

    retry_count = int(state.get("retry_count") or 0)
    email_found = bool(state.get("email_found"))

    if email_found and retry_count < ESCALATION_RETRY_LIMIT:
        return "supplier_outreach"
    return "human_escalation"


def build_graph():
    """
    Build and compile the DPP-Flash state machine.

    Flow
    ----
    START → extractor → validator
              ├─ valid   → END
              └─ invalid → sap_enrichment
                                ├─ email & retries left → supplier_outreach → END
                                └─ no email / retries exhausted → human_escalation → END
    """
    workflow: StateGraph = StateGraph(DPPState)

    workflow.add_node("extractor", extractor_node)
    workflow.add_node("validator", validator_node)
    workflow.add_node("sap_enrichment", sap_enrichment_node)
    workflow.add_node("supplier_outreach", supplier_outreach_node)
    workflow.add_node("human_escalation", human_escalation_node)

    workflow.add_edge(START, "extractor")
    workflow.add_edge("extractor", "validator")

    workflow.add_conditional_edges(
        "validator",
        route_after_validation,
        {
            "end": END,
            "sap_enrichment": "sap_enrichment",
        },
    )

    workflow.add_conditional_edges(
        "sap_enrichment",
        route_after_sap_enrichment,
        {
            "supplier_outreach": "supplier_outreach",
            "human_escalation": "human_escalation",
        },
    )

    workflow.add_edge("supplier_outreach", END)
    workflow.add_edge("human_escalation", END)

    return workflow.compile()


# LangGraph Studio entrypoint (langgraph.json → graph.py:app)
app = build_graph()
