"""Apply tenant Stammdaten to product drafts."""

from __future__ import annotations

from typing import Any

from etl.dpp_flash.inbound.fusion import deep_merge_dpp
from etl.dpp_flash.inbound.models import ProductPassportDraft
from etl.dpp_flash.inbound.stammdaten_constants import STAMMDATEN_PAYLOAD_KEYS
from etl.dpp_flash.inbound.stammdaten_repository import TenantStammdatenRepository


def strip_stammdaten_from_product_row(row: dict[str, Any]) -> dict[str, Any]:
    """Remove Stammdaten keys from a flat import row (Excel/staging)."""
    return {key: value for key, value in row.items() if key not in STAMMDATEN_PAYLOAD_KEYS}


def tenant_stammdaten_to_draft_payload(record: dict[str, Any] | None) -> dict[str, Any]:
    if not record:
        return {}
    payload: dict[str, Any] = {}
    if record.get("hersteller"):
        payload["hersteller"] = record["hersteller"]
    if record.get("herstelleradresse"):
        payload["herstelleradresse"] = record["herstelleradresse"]
    if record.get("eori"):
        payload["eori"] = record["eori"]
    kontakt = record.get("kontakt")
    if kontakt and isinstance(kontakt, dict):
        if any(kontakt.get(key) for key in ("name", "email", "phone")):
            payload["kontakt"] = kontakt
    return payload


def apply_tenant_stammdaten_to_draft(
    draft: ProductPassportDraft,
    tenant_id: str,
    repository: TenantStammdatenRepository,
) -> ProductPassportDraft:
    """Merge tenant Stammdaten as master (fills empty product fields)."""
    record = repository.get_stammdaten(tenant_id)
    master = tenant_stammdaten_to_draft_payload(record)
    if not master:
        return draft
    fused = deep_merge_dpp(master, draft.model_dump(mode="json", exclude_unset=True))
    return ProductPassportDraft(**fused)
