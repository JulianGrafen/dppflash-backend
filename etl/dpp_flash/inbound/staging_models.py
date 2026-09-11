"""Pydantic models for inbound staging events (triage before merge)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

StagingSource = Literal["ERP_WEBHOOK", "CSV_UPLOAD", "PDF_EXTRACT", "PIM_WEBHOOK"]
StagingStatus = Literal["PENDING", "ORPHAN", "CONFLICT", "PROCESSED"]

_ANCHOR_UPI_KEYS = frozenset({"upi", "sku"})
_ANCHOR_GTIN_KEYS = frozenset({"gtin", "ean"})


class IngestPayload(BaseModel):
    """Generic ingest payload — extracts upi/gtin; other fields land in additional_data."""

    model_config = ConfigDict(extra="allow")

    upi: str | None = None
    gtin: str | None = None
    additional_data: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="before")
    @classmethod
    def _split_known_identifiers(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        payload = dict(data)
        additional: dict[str, Any] = {}
        upi: str | None = None
        gtin: str | None = None

        for key, value in payload.items():
            if value is None or (isinstance(value, str) and not value.strip()):
                continue
            normalized = str(key).strip().casefold()
            compact = normalized.replace(" ", "").replace("-", "").replace("_", "")
            if normalized in _ANCHOR_UPI_KEYS or compact in _ANCHOR_UPI_KEYS:
                upi = str(value).strip()
            elif normalized in _ANCHOR_GTIN_KEYS or compact in {"gtin", "ean", "ean13"}:
                gtin = str(value).strip()
            else:
                additional[key] = value

        return {"upi": upi, "gtin": gtin, "additional_data": additional, **additional}


class StagingEventCreate(BaseModel):
    """Row to insert into staging_events."""

    tenant_id: str = Field(min_length=1)
    source: StagingSource
    extracted_upi: str | None = None
    payload: dict[str, Any]
    status: StagingStatus


class StagingEventRecord(BaseModel):
    """Persisted staging event."""

    id: str
    tenant_id: str
    source: StagingSource
    extracted_upi: str | None = None
    payload: dict[str, Any]
    status: StagingStatus
    created_at: datetime | str
