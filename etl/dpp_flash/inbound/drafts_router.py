"""List persisted product passport drafts."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query

from etl.dpp_flash.inbound.repository import get_dpp_draft_repository

router = APIRouter(prefix="/api/v1/dpp", tags=["dpp-drafts"])


@router.get("/drafts")
async def list_dpp_drafts(
    tenant_id: str = Query(min_length=1),
    limit: int = Query(default=100, ge=1, le=500),
    repository=Depends(get_dpp_draft_repository),
) -> dict[str, Any]:
    """Return persisted drafts for a tenant (newest first)."""
    items = repository.list_dpp_drafts(tenant_id=tenant_id, limit=limit)
    return {"tenant_id": tenant_id, "count": len(items), "items": items}
