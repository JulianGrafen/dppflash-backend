"""Match PDF/SDS enrichments to Excel/ERP master products.

Join strategy (in order):
1. **UPI** — exact match on ``unique product identifier`` / Excel ``Artikelnummer``
2. **GTIN** — fallback when UPI differs (e.g. PDF used filename fallback)
3. **Manual** — operator links via POST /api/v1/dpp/match

Excel/ERP rows are always *master*; PDF extractions are *enrichment* and get fused
with :func:`etl.dpp_flash.inbound.fusion.deep_merge_dpp` (master wins on conflicts).
"""

from __future__ import annotations

from typing import Any, Literal

from etl.dpp_flash.inbound.models import ProductPassportDraft

MatchReason = Literal["upi", "gtin", "manual", "none"]
MASTER_SOURCES = frozenset({"kmu_excel", "enterprise_ingest"})


def _normalize_key(value: str | None) -> str:
    return (value or "").strip().casefold()


def _row_gtin(row: dict[str, Any]) -> str | None:
    payload = row.get("payload") or {}
    gtin = payload.get("gtin")
    return str(gtin).strip() if gtin else None


def is_master_row(row: dict[str, Any]) -> bool:
    """True when this row can receive enrichment (Excel/ERP master or already fused)."""
    status = row.get("match_status")
    if status in {"master", "enriched"}:
        return True
    return row.get("source") in MASTER_SOURCES and status != "unmatched"


def find_master_for_enrichment(
    enrichment: ProductPassportDraft,
    rows: list[dict[str, Any]],
) -> tuple[str | None, MatchReason]:
    """Return ``(master_upi, match_reason)`` for an enrichment draft."""
    masters = [row for row in rows if is_master_row(row)]
    if not masters:
        return None, "none"

    enrichment_upi = _normalize_key(enrichment.upi)
    for row in masters:
        if _normalize_key(row.get("upi")) == enrichment_upi:
            return str(row["upi"]), "upi"

    if enrichment.gtin:
        target_gtin = _normalize_key(enrichment.gtin)
        for row in masters:
            row_gtin = _normalize_key(_row_gtin(row))
            if row_gtin and row_gtin == target_gtin:
                return str(row["upi"]), "gtin"

    return None, "none"
