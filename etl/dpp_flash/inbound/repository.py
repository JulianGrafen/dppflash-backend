"""Persistence layer for product passport drafts (Supabase / PostgreSQL)."""

from __future__ import annotations

import os
from typing import Any, Literal, Protocol

from etl.dpp_flash.inbound.models import ProductPassportDraft

DraftSource = Literal["kmu_excel", "pdf_extract", "enterprise_ingest"]


class DppDraftRepository(Protocol):
    def save_dpp_draft(
        self,
        dpp: ProductPassportDraft,
        tenant_id: str,
        *,
        source: DraftSource,
        raw_extraction: dict[str, Any] | None = None,
        match_status: str = "master",
        master_upi: str | None = None,
        matched_by: str | None = None,
    ) -> dict[str, Any]: ...

    def upsert_row(self, row: dict[str, Any]) -> dict[str, Any]: ...

    def get_draft(self, tenant_id: str, upi: str) -> dict[str, Any] | None: ...

    def delete_draft(self, tenant_id: str, upi: str) -> None: ...

    def list_dpp_drafts(self, tenant_id: str, limit: int = 100) -> list[dict[str, Any]]: ...


def _resolve_supabase_url() -> str | None:
    return (
        os.environ.get("SUPABASE_URL", "").strip()
        or os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").strip()
        or None
    )


def _resolve_supabase_key() -> str | None:
    return os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip() or None


class InMemoryDppDraftRepository:
    """MVP fallback when Supabase is not configured (tests, local dev)."""

    def __init__(self) -> None:
        self._rows: dict[tuple[str, str], dict[str, Any]] = {}

    def upsert_row(self, row: dict[str, Any]) -> dict[str, Any]:
        key = (row["tenant_id"], row["upi"])
        stored = {**row, "id": row.get("id") or f"mem-{key[0]}-{key[1]}"}
        self._rows[key] = stored
        return stored

    def save_dpp_draft(
        self,
        dpp: ProductPassportDraft,
        tenant_id: str,
        *,
        source: DraftSource,
        raw_extraction: dict[str, Any] | None = None,
        match_status: str = "master",
        master_upi: str | None = None,
        matched_by: str | None = None,
    ) -> dict[str, Any]:
        return self.upsert_row(
            {
                "tenant_id": tenant_id,
                "upi": dpp.upi,
                "source": source,
                "payload": dpp.model_dump(mode="json"),
                "raw_extraction": raw_extraction,
                "is_draft": dpp.is_draft,
                "match_status": match_status,
                "master_upi": master_upi,
                "matched_by": matched_by,
                "validation_status": "pending",
            }
        )

    def get_draft(self, tenant_id: str, upi: str) -> dict[str, Any] | None:
        return self._rows.get((tenant_id, upi))

    def delete_draft(self, tenant_id: str, upi: str) -> None:
        self._rows.pop((tenant_id, upi), None)

    def list_dpp_drafts(self, tenant_id: str, limit: int = 100) -> list[dict[str, Any]]:
        rows = [row for key, row in self._rows.items() if key[0] == tenant_id]
        rows.sort(key=lambda row: row.get("created_at", row.get("upi", "")), reverse=True)
        return rows[:limit]


class SupabaseDppDraftRepository:
    """Supabase-backed repository using the service-role key (server-side only)."""

    def __init__(self) -> None:
        url = _resolve_supabase_url()
        key = _resolve_supabase_key()
        if not url or not key:
            raise RuntimeError(
                "Supabase not configured: set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) "
                "and SUPABASE_SERVICE_ROLE_KEY."
            )
        from supabase import create_client

        self._client = create_client(url, key)

    def upsert_row(self, row: dict[str, Any]) -> dict[str, Any]:
        response = (
            self._client.table("product_passports")
            .upsert(row, on_conflict="tenant_id,upi")
            .execute()
        )
        if not response.data:
            raise RuntimeError("Supabase upsert returned no data.")
        return response.data[0]

    def save_dpp_draft(
        self,
        dpp: ProductPassportDraft,
        tenant_id: str,
        *,
        source: DraftSource,
        raw_extraction: dict[str, Any] | None = None,
        match_status: str = "master",
        master_upi: str | None = None,
        matched_by: str | None = None,
    ) -> dict[str, Any]:
        return self.upsert_row(
            {
                "tenant_id": tenant_id,
                "upi": dpp.upi,
                "source": source,
                "payload": dpp.model_dump(mode="json"),
                "raw_extraction": raw_extraction,
                "is_draft": dpp.is_draft,
                "match_status": match_status,
                "master_upi": master_upi,
                "matched_by": matched_by,
                "validation_status": "pending",
            }
        )

    def get_draft(self, tenant_id: str, upi: str) -> dict[str, Any] | None:
        response = (
            self._client.table("product_passports")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("upi", upi)
            .limit(1)
            .execute()
        )
        if not response.data:
            return None
        return response.data[0]

    def delete_draft(self, tenant_id: str, upi: str) -> None:
        self._client.table("product_passports").delete().eq("tenant_id", tenant_id).eq(
            "upi", upi
        ).execute()

    def list_dpp_drafts(self, tenant_id: str, limit: int = 100) -> list[dict[str, Any]]:
        response = (
            self._client.table("product_passports")
            .select("*")
            .eq("tenant_id", tenant_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return list(response.data or [])


_default_repository = InMemoryDppDraftRepository()


def get_dpp_draft_repository() -> InMemoryDppDraftRepository | SupabaseDppDraftRepository:
    """FastAPI dependency — Supabase when explicitly enabled, otherwise in-memory."""
    if os.environ.get("DPP_INBOUND_REPOSITORY", "").strip().lower() != "supabase":
        return _default_repository
    if _resolve_supabase_url() and _resolve_supabase_key():
        return SupabaseDppDraftRepository()
    return _default_repository
