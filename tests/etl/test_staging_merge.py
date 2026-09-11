"""Tests for staging → product_passports merge."""

from __future__ import annotations

from etl.dpp_flash.inbound.repository import InMemoryDppDraftRepository
from etl.dpp_flash.inbound.staging_merge import (
    apply_open_duplicate_conflict,
    ingest_and_maybe_merge,
    merge_staging_event,
)
from etl.dpp_flash.inbound.staging_repository import InMemoryStagingEventRepository
from etl.dpp_flash.inbound.triage import process_incoming_data


def test_auto_merge_creates_master_passport() -> None:
    staging = InMemoryStagingEventRepository()
    drafts = InMemoryDppDraftRepository()
    stored = ingest_and_maybe_merge(
        {"SKU": "NEW-MASTER-1", "Title": "Widget"},
        "ERP_WEBHOOK",
        "merge-tenant-1",
        staging_repo=staging,
        draft_repo=drafts,
    )
    assert stored["status"] == "PROCESSED"
    assert stored["merged_upi"] == "NEW-MASTER-1"
    passport = drafts.get_draft("merge-tenant-1", "NEW-MASTER-1")
    assert passport is not None
    assert passport["match_status"] == "master"


def test_auto_merge_fuses_into_existing_master() -> None:
    staging = InMemoryStagingEventRepository()
    drafts = InMemoryDppDraftRepository()
    ingest_and_maybe_merge(
        {"SKU": "FUSE-1", "hersteller": "Master GmbH"},
        "CSV_UPLOAD",
        "merge-tenant-2",
        staging_repo=staging,
        draft_repo=drafts,
    )
    stored = ingest_and_maybe_merge(
        {"SKU": "FUSE-1", "Gewicht": "2.5 kg"},
        "ERP_WEBHOOK",
        "merge-tenant-2",
        staging_repo=staging,
        draft_repo=drafts,
    )
    assert stored["status"] == "PROCESSED"
    passport = drafts.get_draft("merge-tenant-2", "FUSE-1")
    payload = passport["payload"]
    assert payload.get("hersteller") == "Master GmbH"
    assert payload.get("weight") == "2.5 kg"


def test_duplicate_open_upi_marks_conflict() -> None:
    staging = InMemoryStagingEventRepository()
    event = process_incoming_data({"SKU": "DUP-1"}, "ERP_WEBHOOK", "merge-tenant-3")
    staging.insert_event(event.model_copy(update={"status": "PENDING"}))
    status = apply_open_duplicate_conflict("PENDING", "DUP-1", "merge-tenant-3", staging)
    assert status == "CONFLICT"


def test_orphan_assign_and_merge() -> None:
    staging = InMemoryStagingEventRepository()
    drafts = InMemoryDppDraftRepository()
    orphan = process_incoming_data({"Title": "No id"}, "CSV_UPLOAD", "merge-tenant-4")
    stored = staging.insert_event(orphan)
    assert stored["status"] == "ORPHAN"
    updated = staging.update_event(
        stored["id"],
        extracted_upi="ORPHAN-ASSIGNED",
        status="PENDING",
    )
    result = merge_staging_event(updated, draft_repo=drafts, staging_repo=staging)
    assert result.success is True
    assert result.event["status"] == "PROCESSED"


def test_merge_validation_error_sets_merge_error() -> None:
    staging = InMemoryStagingEventRepository()
    drafts = InMemoryDppDraftRepository()
    bad = process_incoming_data(
        {"SKU": "BAD-GTIN", "EAN": "not-a-gtin"},
        "ERP_WEBHOOK",
        "merge-tenant-5",
    )
    stored = staging.insert_event(bad)
    result = merge_staging_event(stored, draft_repo=drafts, staging_repo=staging)
    assert result.success is False
    assert result.event.get("merge_error")
