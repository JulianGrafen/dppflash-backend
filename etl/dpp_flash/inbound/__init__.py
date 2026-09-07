"""Inbound push API for DPP-Flash — funnel principle (SAP push + SDS enrichment).

Public surface:
    models      — Pydantic V2 ESPR schema (ProductPassportDraft & friends)
    fusion      — deep_merge_dpp master-fallback data fusion
    repository  — Supabase persistence layer (interface + mock)
    router      — FastAPI router for POST /api/v1/dpp/ingest
"""

from etl.dpp_flash.inbound.fusion import deep_merge_dpp
from etl.dpp_flash.inbound.models import BillOfMaterialItem, Contact, ProductPassportDraft

__all__ = [
    "BillOfMaterialItem",
    "Contact",
    "ProductPassportDraft",
    "deep_merge_dpp",
]
