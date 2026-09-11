"""Map raw staging payloads to canonical ProductPassportDraft fields."""

from __future__ import annotations

from typing import Any

from pydantic import ValidationError

from etl.dpp_flash.inbound.kmu_upload import assemble_draft_row, resolve_canonical_field
from etl.dpp_flash.inbound.models import ProductPassportDraft


def canonicalize_staging_payload(raw: dict[str, Any]) -> dict[str, Any]:
    """Strip staging meta and map header aliases to inbound field names."""
    canonical: dict[str, Any] = {}
    for key, value in raw.items():
        if str(key).startswith("_"):
            continue
        if value is None or (isinstance(value, str) and not value.strip()):
            continue
        field = resolve_canonical_field(key)
        target_key = field if field else str(key)
        if target_key not in canonical:
            canonical[target_key] = value
    return assemble_draft_row(canonical)


def staging_payload_to_draft(
    event_row: dict[str, Any],
) -> ProductPassportDraft:
    """Build a passport draft from a staging_events row."""
    payload = dict(event_row.get("payload") or {})
    canonical = canonicalize_staging_payload(payload)
    extracted = event_row.get("extracted_upi")
    if not canonical.get("upi") and extracted:
        canonical["upi"] = str(extracted).strip()
    try:
        return ProductPassportDraft(**canonical)
    except ValidationError as exc:
        raise ValueError(
            "; ".join(
                f"{'.'.join(str(part) for part in err.get('loc', ()))}: {err.get('msg')}"
                for err in exc.errors(include_url=False, include_context=False)
            )
        ) from exc
