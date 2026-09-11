"""Tenant inbound Stammdaten (dashboard entry)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status

from etl.dpp_flash.inbound.stammdaten_models import TenantStammdatenUpsert
from etl.dpp_flash.inbound.stammdaten_repository import (
    TenantStammdatenRepository,
    get_tenant_stammdaten_repository,
)

router = APIRouter(prefix="/api/v1/inbound", tags=["inbound-stammdaten"])


@router.get("/stammdaten", status_code=status.HTTP_200_OK)
async def get_tenant_stammdaten(
    tenant_id: str = Query(min_length=1),
    repository: TenantStammdatenRepository = Depends(get_tenant_stammdaten_repository),
) -> dict[str, Any]:
    row = repository.get_stammdaten(tenant_id)
    if not row:
        return {"tenant_id": tenant_id, "stammdaten": None}
    return {"tenant_id": tenant_id, "stammdaten": row}


@router.put("/stammdaten", status_code=status.HTTP_200_OK)
async def upsert_tenant_stammdaten(
    body: TenantStammdatenUpsert,
    tenant_id: str = Query(min_length=1),
    repository: TenantStammdatenRepository = Depends(get_tenant_stammdaten_repository),
) -> dict[str, Any]:
    stored = repository.upsert_stammdaten(tenant_id, body)
    return {"tenant_id": tenant_id, "stammdaten": stored}
