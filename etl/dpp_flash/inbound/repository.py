"""Persistence layer for product passport drafts (Supabase / PostgreSQL).

MVP: in-memory mock with the exact call shape of the Supabase Python client, so
swapping in the real client is a one-line change inside :func:`save_dpp_draft`.

Target table (RLS-enabled)::

    create table product_passports (
        id          uuid primary key default gen_random_uuid(),
        tenant_id   uuid not null,
        upi         text not null,
        payload     jsonb not null,
        is_draft    boolean not null default true,
        created_at  timestamptz not null default now(),
        unique (tenant_id, upi)
    );
    alter table product_passports enable row level security;
    create policy tenant_isolation on product_passports
        using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
"""

from __future__ import annotations

from typing import Any, Protocol

from etl.dpp_flash.inbound.models import ProductPassportDraft


class DppDraftRepository(Protocol):
    """Interface so the router never depends on a concrete storage backend."""

    def save_dpp_draft(self, dpp: ProductPassportDraft, tenant_id: str) -> dict[str, Any]:
        """Persist a draft; returns the stored row (id, tenant_id, upi, payload)."""
        ...


class InMemoryDppDraftRepository:
    """MVP mock — keeps drafts in memory, keyed by (tenant_id, upi)."""

    def __init__(self) -> None:
        self._rows: dict[tuple[str, str], dict[str, Any]] = {}

    def save_dpp_draft(self, dpp: ProductPassportDraft, tenant_id: str) -> dict[str, Any]:
        """Upsert the draft for this tenant (mirrors the Supabase upsert below).

        Real Supabase implementation::

            from supabase import create_client
            client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
            response = (
                client.table("product_passports")
                .upsert(
                    {
                        "tenant_id": tenant_id,          # RLS partition key
                        "upi": dpp.upi,
                        "payload": dpp.model_dump(mode="json"),
                        "is_draft": dpp.is_draft,
                    },
                    on_conflict="tenant_id,upi",
                )
                .execute()
            )
            return response.data[0]
        """
        row = {
            "tenant_id": tenant_id,
            "upi": dpp.upi,
            "payload": dpp.model_dump(mode="json"),
            "is_draft": dpp.is_draft,
        }
        self._rows[(tenant_id, dpp.upi)] = row
        return row


_default_repository = InMemoryDppDraftRepository()


def get_dpp_draft_repository() -> DppDraftRepository:
    """FastAPI dependency — swap for a Supabase-backed instance in production."""
    return _default_repository
