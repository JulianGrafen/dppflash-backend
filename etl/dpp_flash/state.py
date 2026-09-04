"""
DPP-Flash pipeline state — single source of truth for the LangGraph scaffold.

The state is intentionally flat and JSON-serialisable so LangGraph Studio
can inspect runs without Pydantic coercion layers.
"""

from __future__ import annotations

from typing import Any, NotRequired, TypedDict


class DPPState(TypedDict):
    """
    Central graph state for the DPP-Flash compliance pipeline.

    Required keys
    -------------
    product_id      Internal SKU / article identifier.
    raw_document    Source text (SDS, BOM, supplier sheet).
    extracted_data  Structured DPP fields produced by the extractor.
    is_valid        True when all mandatory fields pass validation.
    gaps            Field paths or labels still missing / invalid.
    status          Pipeline lifecycle marker (e.g. ``draft``, ``pending_supplier``).
    retry_count     Supplier-outreach attempts (escalate at >= 3).
    """

    product_id: str
    raw_document: str
    extracted_data: dict[str, Any]
    is_valid: bool
    gaps: list[str]
    status: str
    retry_count: int

    # Routing / enrichment (optional at start, populated by nodes)
    supplier_email: NotRequired[str | None]
    email_source: NotRequired[str | None]
    email_found: NotRequired[bool]
    errors: NotRequired[list[str]]


# ── Domain constants ───────────────────────────────────────────────────────────

MANDATORY_FIELDS: tuple[str, ...] = (
    "product_name",
    "manufacturer",
    "material_composition",
    "co2_kg",
)

DEFAULT_STATUS = "draft"
ESCALATION_RETRY_LIMIT = 3

STATUS_EMAIL_FOUND = "EMAIL_FOUND"
STATUS_REQUIRES_HUMAN_INTERVENTION = "REQUIRES_HUMAN_INTERVENTION"


def initial_state(
    *,
    product_id: str,
    raw_document: str,
) -> DPPState:
    """Build a valid initial ``DPPState`` for ``graph.invoke`` / Studio."""
    return {
        "product_id": product_id,
        "raw_document": raw_document,
        "extracted_data": {},
        "is_valid": False,
        "gaps": [],
        "status": DEFAULT_STATUS,
        "retry_count": 0,
        "supplier_email": None,
        "email_source": None,
        "email_found": False,
        "errors": [],
    }
