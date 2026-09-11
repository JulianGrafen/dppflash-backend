"""Inbound staging ingest — webhook and file upload into staging_events.

Supabase DDL (run migration 20260908140000_staging_events.sql):

    create table public.staging_events (
      id uuid primary key default gen_random_uuid(),
      tenant_id text not null,
      source text not null
        check (source in ('ERP_WEBHOOK', 'CSV_UPLOAD', 'PDF_EXTRACT', 'PIM_WEBHOOK')),
      extracted_upi text,
      payload jsonb not null,
      status text not null default 'PENDING'
        check (status in ('PENDING', 'ORPHAN', 'CONFLICT', 'PROCESSED')),
      created_at timestamptz not null default timezone('utc', now())
    );
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

import pandas as pd
from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, ConfigDict, Field

from etl.dpp_flash.inbound.kmu_upload import _read_dataframe
from etl.dpp_flash.inbound.repository import DppDraftRepository, get_dpp_draft_repository
from etl.dpp_flash.inbound.staging_merge import ingest_and_maybe_merge, merge_staging_event
from etl.dpp_flash.inbound.staging_models import StagingSource
from etl.dpp_flash.inbound.staging_normalize import (
    canonicalize_staging_payload,
    staging_payload_to_draft,
)
from etl.dpp_flash.inbound.staging_repository import (
    StagingEventRepository,
    get_staging_event_repository,
)
from etl.dpp_flash.inbound.validation_service import validate_passport_draft

router = APIRouter(prefix="/api/v1/inbound", tags=["inbound-staging"])

_VALID_SOURCES: frozenset[str] = frozenset(
    {"ERP_WEBHOOK", "CSV_UPLOAD", "PDF_EXTRACT", "PIM_WEBHOOK"}
)


class WebhookIngestBody(BaseModel):
    """ERP webhook JSON — tenant_id plus arbitrary product fields."""

    model_config = ConfigDict(extra="allow")

    tenant_id: str | None = Field(default=None, min_length=1)


class StagingIngestItem(BaseModel):
    id: str
    status: str
    extracted_upi: str | None
    source: StagingSource
    merged_upi: str | None = None
    merge_error: str | None = None


class WebhookIngestResponse(BaseModel):
    tenant_id: str
    event: StagingIngestItem


class FileIngestResponse(BaseModel):
    tenant_id: str
    count: int
    items: list[StagingIngestItem]


class AssignUpiBody(BaseModel):
    upi: str = Field(min_length=1)


def _resolve_source(header_value: str | None, default: StagingSource) -> StagingSource:
    if not header_value:
        return default
    normalized = header_value.strip().upper()
    if normalized not in _VALID_SOURCES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid X-Ingest-Source. Allowed: {sorted(_VALID_SOURCES)}",
        )
    return normalized  # type: ignore[return-value]


def _dataframe_to_row_dicts(frame: pd.DataFrame) -> list[dict[str, Any]]:
    normalized = frame.astype(object).where(pd.notna(frame), None)
    return normalized.to_dict(orient="records")


def _to_ingest_item(stored: dict[str, Any]) -> StagingIngestItem:
    return StagingIngestItem(
        id=str(stored["id"]),
        status=str(stored["status"]),
        extracted_upi=stored.get("extracted_upi"),
        source=stored["source"],
        merged_upi=stored.get("merged_upi"),
        merge_error=stored.get("merge_error"),
    )


def _get_event_or_404(
    repository: StagingEventRepository,
    tenant_id: str,
    event_id: str,
) -> dict[str, Any]:
    row = repository.get_event(tenant_id, event_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staging event not found.")
    return row


@router.post("/ingest/webhook", response_model=WebhookIngestResponse, status_code=status.HTTP_201_CREATED)
async def ingest_webhook(
    body: WebhookIngestBody,
    tenant_id: str | None = Query(default=None, min_length=1),
    x_ingest_source: str | None = Header(default=None, alias="X-Ingest-Source"),
    staging_repo: StagingEventRepository = Depends(get_staging_event_repository),
    draft_repo: DppDraftRepository = Depends(get_dpp_draft_repository),
) -> WebhookIngestResponse:
    """Accept a JSON payload from an ERP/PIM webhook and stage it for triage."""
    resolved_tenant = body.tenant_id or tenant_id
    if not resolved_tenant:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="tenant_id is required (query param or JSON body).",
        )

    source = _resolve_source(x_ingest_source, "ERP_WEBHOOK")
    payload = body.model_dump(exclude={"tenant_id"}, exclude_none=True)
    stored = ingest_and_maybe_merge(
        payload,
        source,
        resolved_tenant,
        staging_repo=staging_repo,
        draft_repo=draft_repo,
    )

    return WebhookIngestResponse(
        tenant_id=resolved_tenant,
        event=_to_ingest_item(stored),
    )


@router.post("/ingest/file", response_model=FileIngestResponse, status_code=status.HTTP_201_CREATED)
async def ingest_file(
    file: UploadFile = File(...),
    tenant_id: str = Form(default="default"),
    x_ingest_source: str | None = Header(default=None, alias="X-Ingest-Source"),
    staging_repo: StagingEventRepository = Depends(get_staging_event_repository),
    draft_repo: DppDraftRepository = Depends(get_dpp_draft_repository),
) -> FileIngestResponse:
    """Upload CSV/Excel — each row becomes one staging event (PENDING or ORPHAN)."""
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Filename missing.")

    frame = _read_dataframe(file.filename, await file.read())
    rows = _dataframe_to_row_dicts(frame)
    source = _resolve_source(x_ingest_source, "CSV_UPLOAD")

    items: list[StagingIngestItem] = []
    for row in rows:
        clean_row = {
            key: (None if value is None else str(value).strip() if isinstance(value, str) else value)
            for key, value in row.items()
        }
        stored = ingest_and_maybe_merge(
            clean_row,
            source,
            tenant_id,
            staging_repo=staging_repo,
            draft_repo=draft_repo,
        )
        items.append(_to_ingest_item(stored))

    return FileIngestResponse(tenant_id=tenant_id, count=len(items), items=items)


@router.get("/staging/events", status_code=status.HTTP_200_OK)
async def list_staging_events(
    tenant_id: str = Query(min_length=1),
    status_filter: Literal["PENDING", "ORPHAN", "CONFLICT", "PROCESSED"] | None = Query(
        default=None,
        alias="status",
    ),
    limit: int = Query(default=100, ge=1, le=500),
    repository: StagingEventRepository = Depends(get_staging_event_repository),
) -> dict[str, Any]:
    """List staged events for a tenant (newest first)."""
    items = repository.list_events(tenant_id, status=status_filter, limit=limit)
    return {"tenant_id": tenant_id, "count": len(items), "items": items}


@router.get("/staging/events/{event_id}", status_code=status.HTTP_200_OK)
async def get_staging_event(
    event_id: str,
    tenant_id: str = Query(min_length=1),
    repository: StagingEventRepository = Depends(get_staging_event_repository),
) -> dict[str, Any]:
    """Fetch one staging event with normalized draft preview."""
    row = _get_event_or_404(repository, tenant_id, event_id)
    preview_draft: dict[str, Any] | None = None
    preview_error: str | None = None
    if row.get("status") != "ORPHAN" or row.get("extracted_upi"):
        try:
            preview_draft = staging_payload_to_draft(row).model_dump(mode="json")
        except ValueError as exc:
            preview_error = str(exc)
    elif row.get("status") == "ORPHAN":
        preview_draft = canonicalize_staging_payload(dict(row.get("payload") or {}))

    siblings: list[dict[str, Any]] = []
    if row.get("extracted_upi"):
        siblings = repository.list_open_events_for_upi(tenant_id, str(row["extracted_upi"]))
        siblings = [item for item in siblings if str(item.get("id")) != str(event_id)]

    return {
        "event": row,
        "preview_draft": preview_draft,
        "preview_error": preview_error,
        "sibling_events": siblings,
    }


@router.post("/staging/events/{event_id}/merge", status_code=status.HTTP_200_OK)
async def merge_staging_event_endpoint(
    event_id: str,
    tenant_id: str = Query(min_length=1),
    staging_repo: StagingEventRepository = Depends(get_staging_event_repository),
    draft_repo: DppDraftRepository = Depends(get_dpp_draft_repository),
) -> dict[str, Any]:
    """Retry or resolve merge for a staging event."""
    row = _get_event_or_404(staging_repo, tenant_id, event_id)
    result = merge_staging_event(row, draft_repo=draft_repo, staging_repo=staging_repo)
    if not result.success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result.error)
    return {
        "event": result.event,
        "stored_passport": result.stored_passport,
    }


@router.post("/staging/events/{event_id}/assign-upi", status_code=status.HTTP_200_OK)
async def assign_staging_upi(
    event_id: str,
    body: AssignUpiBody,
    tenant_id: str = Query(min_length=1),
    staging_repo: StagingEventRepository = Depends(get_staging_event_repository),
    draft_repo: DppDraftRepository = Depends(get_dpp_draft_repository),
) -> dict[str, Any]:
    """Assign a UPI to an ORPHAN staging event and auto-merge when possible."""
    row = _get_event_or_404(staging_repo, tenant_id, event_id)
    if row.get("status") != "ORPHAN":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only ORPHAN events can be assigned a UPI.",
        )

    upi = body.upi.strip()
    from etl.dpp_flash.inbound.staging_merge import apply_open_duplicate_conflict

    next_status = apply_open_duplicate_conflict("PENDING", upi, tenant_id, staging_repo)
    payload = dict(row.get("payload") or {})
    payload.setdefault("_meta", {})
    if isinstance(payload["_meta"], dict):
        payload["_meta"]["manual_anchor"] = upi

    updated = staging_repo.update_event(
        event_id,
        extracted_upi=upi,
        status=next_status,
        payload=payload,
        merge_error=None,
    )
    if next_status == "PENDING":
        result = merge_staging_event(updated, draft_repo=draft_repo, staging_repo=staging_repo)
        return {"event": result.event, "stored_passport": result.stored_passport, "merge_error": result.error}

    return {"event": updated}


@router.post("/staging/events/{event_id}/dismiss", status_code=status.HTTP_200_OK)
async def dismiss_staging_event(
    event_id: str,
    tenant_id: str = Query(min_length=1),
    repository: StagingEventRepository = Depends(get_staging_event_repository),
) -> dict[str, Any]:
    """Dismiss a staging event without writing to product_passports."""
    row = _get_event_or_404(repository, tenant_id, event_id)
    if row.get("status") == "PROCESSED" and row.get("merged_upi"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Merged staging events cannot be dismissed.",
        )
    payload = dict(row.get("payload") or {})
    meta = dict(payload.get("_meta") or {})
    meta["dismissed"] = True
    payload["_meta"] = meta
    updated = repository.update_event(
        event_id,
        status="PROCESSED",
        merge_error="dismissed",
        processed_at=datetime.now(timezone.utc).isoformat(),
        payload=payload,
    )
    return {"event": updated}


@router.post("/staging/events/{event_id}/preview-validate", status_code=status.HTTP_200_OK)
async def preview_validate_staging_event(
    event_id: str,
    tenant_id: str = Query(min_length=1),
    repository: StagingEventRepository = Depends(get_staging_event_repository),
) -> dict[str, Any]:
    """Run ESPR validation on the normalized staging draft without persisting."""
    row = _get_event_or_404(repository, tenant_id, event_id)
    try:
        draft = staging_payload_to_draft(row)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    result, analysis = validate_passport_draft(draft, row.get("payload"))
    gap_analysis = analysis.calculate_gap_analysis()
    return {
        "validation_status": result.validation_status,
        "readiness_score_percent": result.readiness_score_percent,
        "gap_count": result.gap_count,
        "gaps": [gap.model_dump(mode="json") for gap in result.gaps],
        "validation_report": {
            "validation": result.validation_report,
            "audit": result.audit_report,
            "analysis_snapshot": analysis.model_dump(mode="json"),
            "filled_field_paths": gap_analysis["filled_field_names"],
            "total_field_paths": gap_analysis["total_fields"],
        },
        "preview_draft": draft.model_dump(mode="json"),
    }
