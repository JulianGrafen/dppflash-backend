"""
LangGraph assembly for the DPP-Flash extraction pipeline.
"""

from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from etl.graph.nodes import (
    api_enrichment_node,
    escalate_node,
    espr_auditor_node,
    extractor_node,
    load_to_db_node,
    supplier_outreach_node,
    validator_node,
)
from etl.graph.routing import (
    route_after_api_enrichment,
    route_after_espr_audit,
    route_after_supplier_outreach,
    route_after_validation,
)
from etl.graph.state import DEFAULT_MAX_EXTRACTION_ATTEMPTS, ComplianceStatus, DppGraphState, EnrichmentStage, ValidationStatus


def build_dpp_extraction_graph():
    """
    Enterprise DPP pipeline (maps to project flowchart).

    START → extractor → validator
              ↑              ├─ mass balance retry → extractor
              │              ├─ mass balance OK    → espr_auditor
              │              └─ retries exhausted  → api_enrichment
              │         espr_auditor
              │              ├─ 100% konform → load_to_db → END
              │              └─ gaps        → api_enrichment
              │         api_enrichment
              │              ├─ Daten gefunden → load_to_db → END
              │              └─ NEIN          → supplier_outreach
              │         supplier_outreach
              │              ├─ response  → load_to_db → END
              │              └─ no response → escalate → load_to_db → END
    """
    workflow: StateGraph = StateGraph(DppGraphState)

    workflow.add_node("extractor", extractor_node)
    workflow.add_node("validator", validator_node)
    workflow.add_node("espr_auditor", espr_auditor_node)
    workflow.add_node("api_enrichment", api_enrichment_node)
    workflow.add_node("supplier_outreach", supplier_outreach_node)
    workflow.add_node("escalate", escalate_node)
    workflow.add_node("load_to_db", load_to_db_node)

    workflow.add_edge(START, "extractor")
    workflow.add_edge("extractor", "validator")
    workflow.add_conditional_edges(
        "validator",
        route_after_validation,
        {
            "extractor": "extractor",
            "espr_auditor": "espr_auditor",
            "api_enrichment": "api_enrichment",
        },
    )
    workflow.add_conditional_edges(
        "espr_auditor",
        route_after_espr_audit,
        {
            "load_to_db": "load_to_db",
            "api_enrichment": "api_enrichment",
        },
    )
    workflow.add_conditional_edges(
        "api_enrichment",
        route_after_api_enrichment,
        {
            "load_to_db": "load_to_db",
            "supplier_outreach": "supplier_outreach",
        },
    )
    workflow.add_conditional_edges(
        "supplier_outreach",
        route_after_supplier_outreach,
        {
            "load_to_db": "load_to_db",
            "escalate": "escalate",
        },
    )
    workflow.add_edge("escalate", "load_to_db")
    workflow.add_edge("load_to_db", END)

    return workflow.compile()


graph = build_dpp_extraction_graph()


def initial_state(
    raw_document: dict,
    *,
    sku_master_data: dict | None = None,
    max_extraction_attempts: int = DEFAULT_MAX_EXTRACTION_ATTEMPTS,
) -> DppGraphState:
    from etl.graph.state import RawDocumentInput, SkuMasterData

    return {
        "raw_document": RawDocumentInput.model_validate(raw_document),
        "sku_master_data": SkuMasterData.model_validate(sku_master_data or {}),
        "extracted_data": None,
        "validation_status": ValidationStatus.PENDING,
        "validation_report": None,
        "espr_audit_report": None,
        "gaps": [],
        "gap_remediation": None,
        "enrichment_stage": EnrichmentStage.NONE,
        "enrichment_result": None,
        "compliance_status": ComplianceStatus.DRAFT,
        "db_persist_result": None,
        "extraction_attempt": 0,
        "max_extraction_attempts": max_extraction_attempts,
        "retry_feedback": None,
        "errors": [],
        "metadata": {},
    }
