"""Persistence for tenant_inbound_stammdaten."""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Protocol

from etl.dpp_flash.inbound.repository import _resolve_supabase_key, _resolve_supabase_url
from etl.dpp_flash.inbound.stammdaten_models import TenantStammdaten, TenantStammdatenUpsert


class TenantStammdatenRepository(Protocol):
    def get_stammdaten(self, tenant_id: str) -> dict[str, Any] | None: ...

    def upsert_stammdaten(self, tenant_id: str, data: TenantStammdatenUpsert) -> dict[str, Any]: ...


class InMemoryTenantStammdatenRepository:
    def __init__(self) -> None:
        self._rows: dict[str, dict[str, Any]] = {}

    def get_stammdaten(self, tenant_id: str) -> dict[str, Any] | None:
        return self._rows.get(tenant_id)

    def upsert_stammdaten(self, tenant_id: str, data: TenantStammdatenUpsert) -> dict[str, Any]:
        kontakt = data.kontakt.model_dump(mode="json") if data.kontakt else None
        stored = {
            "tenant_id": tenant_id,
            "hersteller": data.hersteller,
            "herstelleradresse": data.herstelleradresse,
            "kontakt": kontakt,
            "eori": data.eori,
            "taric_code": data.taric_code,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        self._rows[tenant_id] = stored
        return stored


class SupabaseTenantStammdatenRepository:
    def __init__(self) -> None:
        url = _resolve_supabase_url()
        key = _resolve_supabase_key()
        if not url or not key:
            raise RuntimeError("Supabase not configured.")
        from supabase import create_client

        self._client = create_client(url, key)

    def get_stammdaten(self, tenant_id: str) -> dict[str, Any] | None:
        response = (
            self._client.table("tenant_inbound_stammdaten")
            .select("*")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        if not response.data:
            return None
        return response.data[0]

    def upsert_stammdaten(self, tenant_id: str, data: TenantStammdatenUpsert) -> dict[str, Any]:
        kontakt = data.kontakt.model_dump(mode="json") if data.kontakt else None
        row = {
            "tenant_id": tenant_id,
            "hersteller": data.hersteller,
            "herstelleradresse": data.herstelleradresse,
            "kontakt": kontakt,
            "eori": data.eori,
            "taric_code": data.taric_code,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        response = (
            self._client.table("tenant_inbound_stammdaten")
            .upsert(row, on_conflict="tenant_id")
            .execute()
        )
        if not response.data:
            raise RuntimeError("Supabase tenant_inbound_stammdaten upsert returned no data.")
        return response.data[0]


_default_repo = InMemoryTenantStammdatenRepository()


def get_tenant_stammdaten_repository() -> (
    InMemoryTenantStammdatenRepository | SupabaseTenantStammdatenRepository
):
    if os.environ.get("DPP_INBOUND_REPOSITORY", "").strip().lower() != "supabase":
        return _default_repo
    if _resolve_supabase_url() and _resolve_supabase_key():
        return SupabaseTenantStammdatenRepository()
    return _default_repo
