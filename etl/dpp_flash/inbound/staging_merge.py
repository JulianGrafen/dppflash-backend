"""Merge staging_events into product_passports."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Literal

from etl.dpp_flash.inbound.fusion_service import (
    build_master_row,
    fuse_enrichment_into_master,
    try_auto_match_and_fuse,
)
from etl.dpp_flash.inbound.models import ProductPassportDraft
from etl.dpp_flash.inbound.product_matcher import find_master_for_enrichment, is_master_row
from etl.dpp_flash.inbound.repository import DppDraftRepository
from etl.dpp_flash.inbound.staging_models import StagingSource, StagingStatus
from etl.dpp_flash.inbound.staging_normalize import staging_payload_to_draft
from etl.dpp_flash.inbound.staging_repository import StagingEventRepository
from etl.dpp_flash.inbound.validation_service import persist_with_validation

_OPEN_STATUSES: frozenset[StagingStatus] = frozenset({"PENDING", "CONFLICT"})
_MASTER_SOURCES: frozenset[StagingSource] = frozenset(
    {"ERP_WEBHOOK", "CSV_UPLOAD", "PIM_WEBHOOK"}
)


@dataclass
class MergeResult:
    success: bool
    event: dict[str, Any]
    stored_passport: dict[str, Any] | None = None
    error: str | None = None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _draft_source_for_staging(source: StagingSource) -> Literal["kmu_excel", "pdf_extract", "enterprise_ingest"]:
    if source == "CSV_UPLOAD":
        return "kmu_excel"
    if source == "PDF_EXTRACT":
        return "pdf_extract"
    return "enterprise_ingest"


def _other_open_conflicts(
    staging_repo: StagingEventRepository,
    tenant_id: str,
    extracted_upi: str,
    event_id: str,
) -> list[dict[str, Any]]:
    siblings = staging_repo.list_open_events_for_upi(tenant_id, extracted_upi)
    return [row for row in siblings if str(row.get("id")) != str(event_id)]


def merge_staging_event(
    event_row: dict[str, Any],
    *,
    draft_repo: DppDraftRepository,
    staging_repo: StagingEventRepository,
) -> MergeResult:
    """Persist one staging event into product_passports and update staging status."""
    event_id = str(event_row["id"])
    tenant_id = str(event_row["tenant_id"])
    status = str(event_row.get("status") or "")
    source = event_row.get("source") or "ERP_WEBHOOK"
    extracted_upi = event_row.get("extracted_upi")

    if status == "ORPHAN":
        return MergeResult(
            success=False,
            event=event_row,
            error="ORPHAN events require UPI assignment before merge.",
        )
    if status not in _OPEN_STATUSES:
        return MergeResult(
            success=False,
            event=event_row,
            error=f"Event status {status} is not mergeable.",
        )
    if not extracted_upi:
        return MergeResult(
            success=False,
            event=event_row,
            error="extracted_upi is required to merge.",
        )

    if status == "CONFLICT":
        others = _other_open_conflicts(staging_repo, tenant_id, str(extracted_upi), event_id)
        if others:
            return MergeResult(
                success=False,
                event=event_row,
                error="Resolve or dismiss other open events for this UPI before merging.",
            )

    try:
        draft = staging_payload_to_draft(event_row)
    except ValueError as exc:
        updated = staging_repo.update_event(
            event_id,
            merge_error=str(exc),
        )
        return MergeResult(success=False, event=updated, error=str(exc))

    existing_rows = draft_repo.list_dpp_drafts(tenant_id, limit=500)
    draft_source = _draft_source_for_staging(source)  # type: ignore[arg-type]

    try:
        if source in _MASTER_SOURCES:
            master_upi, match_reason = find_master_for_enrichment(draft, existing_rows)
            if master_upi and match_reason != "none":
                master_row = next(
                    row for row in existing_rows if str(row.get("upi")) == master_upi
                )
                row_to_store = fuse_enrichment_into_master(
                    master_row,
                    draft,
                    matched_by=match_reason,
                )
            else:
                direct = draft_repo.get_draft(tenant_id, draft.upi)
                if direct and is_master_row(direct):
                    row_to_store = fuse_enrichment_into_master(
                        direct,
                        draft,
                        matched_by="upi",
                    )
                else:
                    row_to_store = build_master_row(draft, tenant_id, source=draft_source)
            stored, _validation = persist_with_validation(
                draft_repo,
                row_to_store,
                ProductPassportDraft(**(row_to_store.get("payload") or {})),
            )
        else:
            row_to_store, _reason, _master = try_auto_match_and_fuse(
                draft,
                tenant_id,
                existing_rows,
                raw_extraction=event_row.get("payload"),
            )
            merged_draft = ProductPassportDraft(**(row_to_store.get("payload") or {}))
            stored, _validation = persist_with_validation(
                draft_repo,
                row_to_store,
                merged_draft,
                raw_extraction=event_row.get("payload"),
            )

        updated_event = staging_repo.update_event(
            event_id,
            status="PROCESSED",
            merged_upi=str(stored.get("upi") or draft.upi),
            processed_at=_now_iso(),
            merge_error=None,
        )
        return MergeResult(success=True, event=updated_event, stored_passport=stored)
    except Exception as exc:  # pragma: no cover - surfaced to API
        updated = staging_repo.update_event(
            event_id,
            status=status,
            merge_error=str(exc),
        )
        return MergeResult(success=False, event=updated, error=str(exc))


def apply_open_duplicate_conflict(
    event_create_status: str,
    extracted_upi: str | None,
    tenant_id: str,
    staging_repo: StagingEventRepository,
) -> str:
    """Downgrade PENDING to CONFLICT when another open event exists for the UPI."""
    if event_create_status != "PENDING" or not extracted_upi:
        return event_create_status
    if staging_repo.has_open_event(tenant_id, extracted_upi):
        return "CONFLICT"
    return event_create_status


def ingest_and_maybe_merge(
    raw_data: dict[str, Any],
    source: StagingSource,
    tenant_id: str,
    *,
    staging_repo: StagingEventRepository,
    draft_repo: DppDraftRepository,
) -> dict[str, Any]:
    """Triage, detect duplicate UPI conflicts, insert, and auto-merge PENDING rows."""
    from etl.dpp_flash.inbound.triage import process_incoming_data

    event = process_incoming_data(raw_data, source, tenant_id)
    resolved_status = apply_open_duplicate_conflict(
        event.status,
        event.extracted_upi,
        tenant_id,
        staging_repo,
    )
    if resolved_status != event.status:
        event = event.model_copy(update={"status": resolved_status})  # type: ignore[arg-type]

    stored = staging_repo.insert_event(event)
    if stored.get("status") == "PENDING":
        result = merge_staging_event(stored, draft_repo=draft_repo, staging_repo=staging_repo)
        return result.event
    return stored
