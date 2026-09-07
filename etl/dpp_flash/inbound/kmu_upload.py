"""KMU ingest — Excel/CSV ERP exports for the DPP funnel."""

from __future__ import annotations

import io
from typing import Any

import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import ValidationError

from etl.dpp_flash.inbound.fusion_service import build_master_row
from etl.dpp_flash.inbound.models import ProductPassportDraft
from etl.dpp_flash.inbound.repository import DppDraftRepository, get_dpp_draft_repository

router = APIRouter(prefix="/api/v1/kmu", tags=["kmu-ingestion"])

KMU_COLUMN_MAPPING: dict[str, str] = {
    "Artikelnummer": "upi",
    "GTIN": "gtin",
    "Gewicht (kg)": "weight",
    "Herstelleradresse": "manufacturer_address",
    "Entsorgungshinweise": "disposal_instructions",
}

_CSV_SUFFIXES = (".csv",)
_EXCEL_SUFFIXES = (".xlsx", ".xls")


def _read_dataframe(filename: str, content: bytes) -> pd.DataFrame:
    buffer = io.BytesIO(content)
    lowered = filename.lower()
    try:
        if lowered.endswith(_CSV_SUFFIXES):
            return pd.read_csv(buffer, dtype=str)
        if lowered.endswith(_EXCEL_SUFFIXES):
            return pd.read_excel(buffer, dtype=str)
    except Exception as exc:  # pragma: no cover
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File could not be parsed: {exc}",
        ) from exc
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Unsupported file format. Expected .csv, .xlsx or .xls.",
    )


def _normalize_rows(frame: pd.DataFrame) -> list[dict[str, Any]]:
    known = [column for column in frame.columns if column in KMU_COLUMN_MAPPING]
    if not known:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "No known columns found in upload.",
                "expected_columns": sorted(KMU_COLUMN_MAPPING),
            },
        )
    normalized = frame[known].rename(columns=KMU_COLUMN_MAPPING)
    normalized = normalized.astype(object).where(pd.notna(normalized), None)
    return normalized.to_dict(orient="records")


@router.post("/upload-erp-export", status_code=status.HTTP_201_CREATED)
async def upload_erp_export(
    file: UploadFile = File(...),
    tenant_id: str = Form(default="default"),
    persist: bool = Form(default=True),
    repository: DppDraftRepository = Depends(get_dpp_draft_repository),
) -> dict[str, Any]:
    """Normalize a KMU ERP export and persist validated drafts to Supabase."""
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Filename missing."
        )

    frame = _read_dataframe(file.filename, await file.read())
    rows = _normalize_rows(frame)

    drafts: list[dict[str, Any]] = []
    stored: list[dict[str, Any]] = []
    row_errors: list[dict[str, Any]] = []
    for index, row in enumerate(rows):
        try:
            draft = ProductPassportDraft(**row)
        except ValidationError as exc:
            row_errors.append(
                {
                    "row": index + 2,
                    "errors": exc.errors(include_url=False, include_context=False),
                }
            )
            continue
        draft_json = draft.model_dump(mode="json")
        drafts.append(draft_json)
        if persist:
            stored.append(
                repository.upsert_row(
                    build_master_row(draft, tenant_id, source="kmu_excel"),
                )
            )

    if row_errors:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"source": "kmu_upload", "row_errors": row_errors},
        )

    return {
        "tenant_id": tenant_id,
        "count": len(drafts),
        "items": drafts,
        "stored": stored if persist else [],
    }
