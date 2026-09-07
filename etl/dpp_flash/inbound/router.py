"""FastAPI router — inbound funnel endpoint POST /api/v1/dpp/ingest.

Flow: validate SAP master payload → validate SDS enrichment (partial) →
deep-merge (master-fallback) → re-validate fused draft → persist → 201.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, ValidationError

from etl.dpp_flash.inbound.fusion import deep_merge_dpp
from etl.dpp_flash.inbound.fusion_service import build_master_row
from etl.dpp_flash.inbound.models import ProductPassportDraft
from etl.dpp_flash.inbound.repository import DppDraftRepository, get_dpp_draft_repository
from etl.dpp_flash.inbound.validation_service import persist_with_validation

router = APIRouter(prefix="/api/v1/dpp", tags=["dpp-ingestion"])


class DppIngestRequest(BaseModel):
    """Push payload: structured SAP master data plus (mocked) SDS extraction."""

    sap_payload: dict[str, Any] = Field(description="SAP ERP master data (source of truth).")
    sds_extract: dict[str, Any] = Field(
        default_factory=dict,
        description="LangGraph SDS extraction — fills gaps only (master-fallback).",
    )
    tenant_id: str = Field(min_length=1, description="Tenant for RLS partitioning.")


class DppIngestResponse(BaseModel):
    """Validated, fused draft as stored."""

    dpp: ProductPassportDraft
    tenant_id: str


def _validation_http_error(source: str, error: ValidationError) -> HTTPException:
    """Map a Pydantic error to a neutral 422 with the offending payload named."""
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail={
            "source": source,
            # include_context=False keeps the detail JSON-serializable
            # (ctx may contain raw exception objects).
            "errors": error.errors(include_url=False, include_context=False),
        },
    )


@router.post("/ingest", response_model=DppIngestResponse, status_code=status.HTTP_201_CREATED)
async def ingest_dpp(
    body: DppIngestRequest,
    repository: DppDraftRepository = Depends(get_dpp_draft_repository),
) -> DppIngestResponse:
    """Fuse SAP master data with SDS enrichment and persist the draft."""
    try:
        master = ProductPassportDraft(**body.sap_payload)
    except ValidationError as exc:
        raise _validation_http_error("sap_payload", exc) from exc
    master_data = master.model_dump(exclude_unset=True)

    enrichment_data: dict[str, Any] = {}
    if body.sds_extract:
        # Enrichment may omit `upi` — inherit the master key before validation
        # so partial SDS extracts still pass the schema.
        sds_payload = {"upi": master.upi, **body.sds_extract}
        try:
            enrichment = ProductPassportDraft(**sds_payload)
        except ValidationError as exc:
            raise _validation_http_error("sds_extract", exc) from exc
        enrichment_data = enrichment.model_dump(exclude_unset=True)

    fused_result = deep_merge_dpp(master_data, enrichment_data)

    try:
        merged_dpp = ProductPassportDraft(**fused_result)
    except ValidationError as exc:  # defensive — fusion should preserve validity
        raise _validation_http_error("fused_result", exc) from exc

    persist_with_validation(
        repository,
        build_master_row(merged_dpp, body.tenant_id, source="enterprise_ingest"),
        merged_dpp,
        raw_extraction=body.sds_extract or None,
    )
    return DppIngestResponse(dpp=merged_dpp, tenant_id=body.tenant_id)
