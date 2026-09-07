"""Fuse enrichment drafts into master product rows."""

from __future__ import annotations

from typing import Any, Literal

from etl.dpp_flash.inbound.fusion import deep_merge_dpp
from etl.dpp_flash.inbound.models import ProductPassportDraft
from etl.dpp_flash.inbound.product_matcher import MatchReason, find_master_for_enrichment

MatchStatus = Literal["master", "enriched", "unmatched"]


def fuse_enrichment_into_master(
    master_row: dict[str, Any],
    enrichment: ProductPassportDraft,
    *,
    matched_by: MatchReason,
    raw_extraction: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Apply master-fallback merge and return the updated persistence row."""
    master_payload = dict(master_row.get("payload") or {})
    enrichment_payload = enrichment.model_dump(mode="json", exclude_unset=True)
    fused_payload = deep_merge_dpp(master_payload, enrichment_payload)
    merged_draft = ProductPassportDraft(**fused_payload)

    return {
        "tenant_id": master_row["tenant_id"],
        "upi": master_row["upi"],
        "source": master_row.get("source") or "kmu_excel",
        "payload": merged_draft.model_dump(mode="json"),
        "raw_extraction": raw_extraction or master_row.get("raw_extraction"),
        "is_draft": merged_draft.is_draft,
        "match_status": "enriched",
        "master_upi": None,
        "matched_by": matched_by if matched_by != "none" else None,
        "validation_status": "pending",
    }


def build_unmatched_enrichment_row(
    enrichment: ProductPassportDraft,
    tenant_id: str,
    *,
    raw_extraction: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Persist a PDF extraction that could not be auto-matched."""
    return {
        "tenant_id": tenant_id,
        "upi": enrichment.upi,
        "source": "pdf_extract",
        "payload": enrichment.model_dump(mode="json"),
        "raw_extraction": raw_extraction,
        "is_draft": enrichment.is_draft,
        "match_status": "unmatched",
        "master_upi": None,
        "matched_by": None,
        "validation_status": "pending",
    }


def build_master_row(
    draft: ProductPassportDraft,
    tenant_id: str,
    *,
    source: str,
) -> dict[str, Any]:
    """Row shape for Excel/ERP master imports."""
    return {
        "tenant_id": tenant_id,
        "upi": draft.upi,
        "source": source,
        "payload": draft.model_dump(mode="json"),
        "raw_extraction": None,
        "is_draft": draft.is_draft,
        "match_status": "master",
        "master_upi": None,
        "matched_by": None,
        "validation_status": "pending",
    }


def try_auto_match_and_fuse(
    enrichment: ProductPassportDraft,
    tenant_id: str,
    existing_rows: list[dict[str, Any]],
    *,
    raw_extraction: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], MatchReason, str | None]:
    """Auto-match enrichment to a master; returns row to upsert + match metadata.

    Returns:
        (row_dict, match_reason, master_upi)
        When unmatched, row_dict is the orphan enrichment row.
    """
    master_upi, reason = find_master_for_enrichment(enrichment, existing_rows)
    if master_upi and reason != "none":
        master_row = next(row for row in existing_rows if row["upi"] == master_upi)
        fused_row = fuse_enrichment_into_master(
            master_row,
            enrichment,
            matched_by=reason,
            raw_extraction=raw_extraction,
        )
        return fused_row, reason, master_upi

    orphan = build_unmatched_enrichment_row(
        enrichment, tenant_id, raw_extraction=raw_extraction
    )
    return orphan, "none", None
