"""POST /api/v1/dpp/validate — run ESPR validator on stored inbound drafts."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from etl.dpp_flash.inbound.models import ProductPassportDraft
from etl.dpp_flash.inbound.repository import DppDraftRepository, get_dpp_draft_repository
from etl.dpp_flash.inbound.validation_service import (
    persist_with_validation,
    validate_passport_draft,
)

router = APIRouter(prefix="/api/v1/dpp", tags=["dpp-validation"])


class ValidateRequest(BaseModel):
    tenant_id: str = Field(min_length=1)
    upi: str = Field(min_length=1)


class ValidateBatchRequest(BaseModel):
    tenant_id: str = Field(min_length=1)
    limit: int = Field(default=200, ge=1, le=500)


class ValidateResponse(BaseModel):
    tenant_id: str
    upi: str
    readiness_score_percent: float
    gap_count: int
    validation_status: str
    gaps: list[dict[str, Any]]
    stored: dict[str, Any]


def _validate_and_store(
    repository: DppDraftRepository,
    tenant_id: str,
    upi: str,
) -> ValidateResponse:
    row = repository.get_draft(tenant_id, upi)
    if row is None:
        raise HTTPException(status_code=404, detail="Draft not found.")

    draft = ProductPassportDraft(**(row.get("payload") or {}))
    stored, result = persist_with_validation(
        repository,
        row,
        draft,
        raw_extraction=row.get("raw_extraction"),
    )

    return ValidateResponse(
        tenant_id=tenant_id,
        upi=upi,
        readiness_score_percent=result.readiness_score_percent,
        gap_count=result.gap_count,
        validation_status=result.validation_status,
        gaps=[gap.model_dump(mode="json") for gap in result.gaps],
        stored=stored,
    )


@router.post("/validate", response_model=ValidateResponse, status_code=status.HTTP_200_OK)
async def validate_draft(
    body: ValidateRequest,
    repository: DppDraftRepository = Depends(get_dpp_draft_repository),
) -> ValidateResponse:
    """Validate one product passport draft and persist score/gaps."""
    return _validate_and_store(repository, body.tenant_id, body.upi)


@router.post("/validate-batch", status_code=status.HTTP_200_OK)
async def validate_batch(
    body: ValidateBatchRequest,
    repository: DppDraftRepository = Depends(get_dpp_draft_repository),
) -> dict[str, Any]:
    """Validate all drafts for a tenant (up to limit)."""
    rows = repository.list_dpp_drafts(body.tenant_id, limit=body.limit)
    results: list[ValidateResponse] = []
    for row in rows:
        upi = str(row["upi"])
        results.append(_validate_and_store(repository, body.tenant_id, upi))
    return {
        "tenant_id": body.tenant_id,
        "count": len(results),
        "items": [item.model_dump(mode="json") for item in results],
    }
