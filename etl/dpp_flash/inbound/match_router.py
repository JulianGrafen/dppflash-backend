"""Manual and automatic product matching for inbound enrichments."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from etl.dpp_flash.inbound.fusion_service import fuse_enrichment_into_master
from etl.dpp_flash.inbound.models import ProductPassportDraft
from etl.dpp_flash.inbound.repository import DppDraftRepository, get_dpp_draft_repository

router = APIRouter(prefix="/api/v1/dpp", tags=["dpp-matching"])


class ManualMatchRequest(BaseModel):
    tenant_id: str = Field(min_length=1)
    enrichment_upi: str = Field(min_length=1, description="UPI of the unmatched PDF row.")
    master_upi: str = Field(min_length=1, description="UPI of the Excel/ERP master row.")


class ManualMatchResponse(BaseModel):
    master_upi: str
    enrichment_upi: str
    matched_by: str
    stored: dict[str, Any]


@router.post("/match", response_model=ManualMatchResponse, status_code=status.HTTP_200_OK)
async def manual_match_products(
    body: ManualMatchRequest,
    repository: DppDraftRepository = Depends(get_dpp_draft_repository),
) -> ManualMatchResponse:
    """Link an unmatched PDF extraction to an Excel master and fuse data."""
    enrichment_row = repository.get_draft(body.tenant_id, body.enrichment_upi)
    if enrichment_row is None:
        raise HTTPException(status_code=404, detail="Enrichment row not found.")
    if enrichment_row.get("match_status") != "unmatched":
        raise HTTPException(
            status_code=400,
            detail="Only unmatched PDF rows can be manually linked.",
        )

    master_row = repository.get_draft(body.tenant_id, body.master_upi)
    if master_row is None or master_row.get("match_status") == "unmatched":
        raise HTTPException(status_code=404, detail="Master row not found.")

    enrichment_draft = ProductPassportDraft(**(enrichment_row.get("payload") or {}))
    fused_row = fuse_enrichment_into_master(
        master_row,
        enrichment_draft,
        matched_by="manual",
        raw_extraction=enrichment_row.get("raw_extraction"),
    )
    stored = repository.upsert_row(fused_row)
    repository.delete_draft(body.tenant_id, body.enrichment_upi)

    return ManualMatchResponse(
        master_upi=body.master_upi,
        enrichment_upi=body.enrichment_upi,
        matched_by="manual",
        stored=stored,
    )
