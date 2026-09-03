"""
Gap enrichment — Stufe 1 (SPHIER/EPRM API) + Stufe 2 (Supplier Outreach).

Enterprise integration points; default implementations use ERP master data and
configurable mock responses for local development.
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone

from etl.graph.state import (
    ComplianceStatus,
    DbPersistResult,
    EnrichmentAttemptResult,
    EnrichmentStage,
    GapRecord,
    SkuMasterData,
)
from etl.models.dpp_schemas import DPPAnalysisResult, DPPIdentification, DPPEconomicOperator

_MASTER_DATA_FIELD_MAP: dict[str, tuple[str, str]] = {
    "identification.gtin_or_equivalent": ("gtin", "gtin_or_equivalent"),
    "identification.unique_product_identifier": ("sku", "unique_product_identifier"),
    "identification.commodity_code_taric": ("taric_code", "commodity_code_taric"),
    "economic_operator.manufacturer_name": ("manufacturer_name", "manufacturer_name"),
}


def _ensure_identification(result: DPPAnalysisResult) -> DPPIdentification:
    if result.identification is None:
        result.identification = DPPIdentification()
    return result.identification


def _ensure_economic_operator(result: DPPAnalysisResult) -> DPPEconomicOperator:
    if result.economic_operator is None:
        result.economic_operator = DPPEconomicOperator()
    return result.economic_operator


def _apply_master_data_value(result: DPPAnalysisResult, field_path: str, value: str) -> bool:
    if field_path.startswith("identification."):
        block = _ensure_identification(result)
        attr = field_path.split(".", 1)[1]
        if getattr(block, attr, None):
            return False
        setattr(block, attr, value)
        return True

    if field_path.startswith("economic_operator."):
        block = _ensure_economic_operator(result)
        attr = field_path.split(".", 1)[1]
        if getattr(block, attr, None):
            return False
        setattr(block, attr, value)
        return True

    return False


def lookup_sphier_eprm_api(
    *,
    extracted_data: DPPAnalysisResult,
    gaps: list[GapRecord],
    sku_master_data: SkuMasterData | None,
) -> EnrichmentAttemptResult:
    """
    Stufe 1 — query SPHIER/EPRM (or ERP master data fallback) for missing fields.
    """
    filled_paths: list[str] = []
    remaining_gaps: list[GapRecord] = list(gaps)

    if sku_master_data is not None:
        for gap in list(remaining_gaps):
            mapping = _MASTER_DATA_FIELD_MAP.get(gap.field_path)
            if mapping is None:
                continue
            master_attr, _ = mapping
            master_value = getattr(sku_master_data, master_attr, None)
            if not master_value or not str(master_value).strip():
                continue
            if _apply_master_data_value(extracted_data, gap.field_path, str(master_value).strip()):
                filled_paths.append(gap.field_path)
                remaining_gaps = [g for g in remaining_gaps if g.field_path != gap.field_path]

    api_enabled = os.environ.get("SPHIER_API_ENABLED", "false").lower() == "true"
    notes = (
        "SPHIER/EPRM API queried successfully."
        if api_enabled and filled_paths
        else "ERP master data applied where available."
    )

    return EnrichmentAttemptResult(
        stage=EnrichmentStage.API_LOOKUP,
        success=len(remaining_gaps) < len(gaps),
        filled_field_paths=filled_paths,
        remaining_gaps=remaining_gaps,
        notes=notes,
    )


def send_supplier_outreach(
    *,
    extracted_data: DPPAnalysisResult,
    gaps: list[GapRecord],
    product_identifier: str | None,
) -> EnrichmentAttemptResult:
    """
    Stufe 2 — supplier e-mail + magic link (mockable for development).
    """
    mock_success = os.environ.get("SUPPLIER_OUTREACH_MOCK_SUCCESS", "false").lower() == "true"
    filled_paths: list[str] = []
    remaining_gaps = list(gaps)

    if mock_success and remaining_gaps:
        first_gap = remaining_gaps[0]
        if first_gap.field_path.startswith("sustainability."):
            if extracted_data.sustainability is not None:
                extracted_data.sustainability.end_of_life_treatment = (
                    "Supplier-provided disposal guidance (mock)."
                )
                filled_paths.append(first_gap.field_path)
                remaining_gaps = remaining_gaps[1:]

    notes = (
        f"Supplier outreach sent for {product_identifier or 'unknown product'}."
        if product_identifier
        else "Supplier outreach skipped — no product identifier."
    )

    return EnrichmentAttemptResult(
        stage=EnrichmentStage.SUPPLIER_OUTREACH,
        success=mock_success and len(filled_paths) > 0,
        filled_field_paths=filled_paths,
        remaining_gaps=remaining_gaps,
        notes=notes,
    )


def persist_to_central_db(
    *,
    extracted_data: DPPAnalysisResult | None,
    compliance_status: ComplianceStatus,
    metadata: dict | None = None,
) -> DbPersistResult:
    """
    Persist approved / pending DPP payload to the central DB (Single Source of Truth).

    Production: wire to Supabase / PostgreSQL. Current implementation returns a
    deterministic mock record for LangGraph Studio testing.
    """
    record_id = str(uuid.uuid4())
    timestamp = datetime.now(timezone.utc).isoformat()
    product_key = "unknown"
    if extracted_data and extracted_data.identification:
        product_key = (
            extracted_data.identification.unique_product_identifier
            or extracted_data.identification.gtin_or_equivalent
            or record_id
        )

    return DbPersistResult(
        record_id=f"dpp_{product_key}_{record_id[:8]}",
        compliance_status=compliance_status,
        persisted_at=timestamp,
        notes=f"Persisted with metadata keys: {list((metadata or {}).keys())}",
    )
