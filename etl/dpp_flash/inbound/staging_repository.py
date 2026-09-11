"""Persistence for inbound staging_events."""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from typing import Any, Protocol

from etl.dpp_flash.inbound.repository import _resolve_supabase_key, _resolve_supabase_url
from etl.dpp_flash.inbound.staging_models import StagingEventCreate, StagingStatus

_OPEN_STATUSES: frozenset[str] = frozenset({"PENDING", "CONFLICT"})


class StagingEventRepository(Protocol):
    def insert_event(self, event: StagingEventCreate) -> dict[str, Any]: ...

    def list_events(
        self,
        tenant_id: str,
        *,
        status: StagingStatus | None = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]: ...

    def get_event(self, tenant_id: str, event_id: str) -> dict[str, Any] | None: ...

    def update_event(self, event_id: str, **fields: Any) -> dict[str, Any]: ...

    def has_open_event(self, tenant_id: str, extracted_upi: str) -> bool: ...

    def list_open_events_for_upi(
        self,
        tenant_id: str,
        extracted_upi: str,
    ) -> list[dict[str, Any]]: ...


def _normalize_upi(value: str) -> str:
    return value.strip().casefold()


class InMemoryStagingEventRepository:
    """MVP fallback when Supabase is not configured."""

    def __init__(self) -> None:
        self._rows: list[dict[str, Any]] = []

    def insert_event(self, event: StagingEventCreate) -> dict[str, Any]:
        stored = {
            "id": str(uuid.uuid4()),
            "tenant_id": event.tenant_id,
            "source": event.source,
            "extracted_upi": event.extracted_upi,
            "payload": event.payload,
            "status": event.status,
            "merged_upi": None,
            "processed_at": None,
            "merge_error": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        self._rows.append(stored)
        return stored

    def list_events(
        self,
        tenant_id: str,
        *,
        status: StagingStatus | None = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        rows = [row for row in self._rows if row["tenant_id"] == tenant_id]
        if status:
            rows = [row for row in rows if row["status"] == status]
        rows.sort(key=lambda row: row.get("created_at", ""), reverse=True)
        return rows[:limit]

    def get_event(self, tenant_id: str, event_id: str) -> dict[str, Any] | None:
        for row in self._rows:
            if row["tenant_id"] == tenant_id and str(row["id"]) == str(event_id):
                return row
        return None

    def update_event(self, event_id: str, **fields: Any) -> dict[str, Any]:
        for index, row in enumerate(self._rows):
            if str(row["id"]) != str(event_id):
                continue
            updated = {**row, **fields}
            self._rows[index] = updated
            return updated
        raise KeyError(f"staging event not found: {event_id}")

    def has_open_event(self, tenant_id: str, extracted_upi: str) -> bool:
        target = _normalize_upi(extracted_upi)
        return any(
            row["tenant_id"] == tenant_id
            and row.get("extracted_upi")
            and _normalize_upi(str(row["extracted_upi"])) == target
            and row.get("status") in _OPEN_STATUSES
            for row in self._rows
        )

    def list_open_events_for_upi(
        self,
        tenant_id: str,
        extracted_upi: str,
    ) -> list[dict[str, Any]]:
        target = _normalize_upi(extracted_upi)
        return [
            row
            for row in self._rows
            if row["tenant_id"] == tenant_id
            and row.get("extracted_upi")
            and _normalize_upi(str(row["extracted_upi"])) == target
            and row.get("status") in _OPEN_STATUSES
        ]


class SupabaseStagingEventRepository:
    """Supabase-backed staging_events repository."""

    def __init__(self) -> None:
        url = _resolve_supabase_url()
        key = _resolve_supabase_key()
        if not url or not key:
            raise RuntimeError(
                "Supabase not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
            )
        from supabase import create_client

        self._client = create_client(url, key)

    def insert_event(self, event: StagingEventCreate) -> dict[str, Any]:
        row = {
            "tenant_id": event.tenant_id,
            "source": event.source,
            "extracted_upi": event.extracted_upi,
            "payload": event.payload,
            "status": event.status,
        }
        response = self._client.table("staging_events").insert(row).execute()
        if not response.data:
            raise RuntimeError("Supabase staging_events insert returned no data.")
        return response.data[0]

    def list_events(
        self,
        tenant_id: str,
        *,
        status: StagingStatus | None = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        query = (
            self._client.table("staging_events")
            .select("*")
            .eq("tenant_id", tenant_id)
            .order("created_at", desc=True)
            .limit(limit)
        )
        if status:
            query = query.eq("status", status)
        response = query.execute()
        return list(response.data or [])

    def get_event(self, tenant_id: str, event_id: str) -> dict[str, Any] | None:
        response = (
            self._client.table("staging_events")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("id", event_id)
            .limit(1)
            .execute()
        )
        if not response.data:
            return None
        return response.data[0]

    def update_event(self, event_id: str, **fields: Any) -> dict[str, Any]:
        payload = dict(fields)
        response = (
            self._client.table("staging_events")
            .update(payload)
            .eq("id", event_id)
            .execute()
        )
        if not response.data:
            raise RuntimeError("Supabase staging_events update returned no data.")
        return response.data[0]

    def has_open_event(self, tenant_id: str, extracted_upi: str) -> bool:
        response = (
            self._client.table("staging_events")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("extracted_upi", extracted_upi)
            .in_("status", list(_OPEN_STATUSES))
            .limit(1)
            .execute()
        )
        return bool(response.data)

    def list_open_events_for_upi(
        self,
        tenant_id: str,
        extracted_upi: str,
    ) -> list[dict[str, Any]]:
        response = (
            self._client.table("staging_events")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("extracted_upi", extracted_upi)
            .in_("status", list(_OPEN_STATUSES))
            .execute()
        )
        return list(response.data or [])


_default_staging_repository = InMemoryStagingEventRepository()


def get_staging_event_repository() -> (
    InMemoryStagingEventRepository | SupabaseStagingEventRepository
):
    """FastAPI dependency — Supabase when explicitly enabled, otherwise in-memory."""
    if os.environ.get("DPP_INBOUND_REPOSITORY", "").strip().lower() != "supabase":
        return _default_staging_repository
    if _resolve_supabase_url() and _resolve_supabase_key():
        return SupabaseStagingEventRepository()
    return _default_staging_repository
