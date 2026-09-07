"""KMU ingest — Excel/CSV ERP exports for the DPP funnel.

Small/medium enterprises rarely push clean JSON. This router accepts their raw
ERP export (CSV or XLSX), normalizes the German column names via a declarative
mapping, converts pandas NaN/NaT to ``None`` and validates every row against the
same :class:`ProductPassportDraft` schema the enterprise JSON funnel uses.

Rows are treated as *master data*; enrichment sources can later be fused via
:func:`etl.dpp_flash.inbound.fusion.deep_merge_dpp` exactly like the JSON path.
"""

from __future__ import annotations

import io
from typing import Any

import pandas as pd
from fastapi import APIRouter, File, HTTPException, UploadFile, status
from pydantic import ValidationError

from etl.dpp_flash.inbound.models import ProductPassportDraft

router = APIRouter(prefix="/api/v1/kmu", tags=["kmu-ingestion"])

# Declarative ERP-column → ESPR-field mapping. Extend per customer template.
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
    """Parse the upload into a DataFrame; every cell as string (dtype=str).

    ``dtype=str`` prevents pandas from mangling GTINs into floats
    (``4006381333931`` → ``4.006381333931e12``) when a column contains NaN.
    """
    buffer = io.BytesIO(content)
    lowered = filename.lower()
    try:
        if lowered.endswith(_CSV_SUFFIXES):
            return pd.read_csv(buffer, dtype=str)
        if lowered.endswith(_EXCEL_SUFFIXES):
            return pd.read_excel(buffer, dtype=str)
    except Exception as exc:  # pragma: no cover — parser-specific errors
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File could not be parsed: {exc}",
        ) from exc
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Unsupported file format. Expected .csv, .xlsx or .xls.",
    )


def _normalize_rows(frame: pd.DataFrame) -> list[dict[str, Any]]:
    """Rename mapped columns, drop unmapped ones, convert NaN/NaT to None."""
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
    # `object` dtype allows None; .where() maps every NaN/NaT to None.
    normalized = normalized.astype(object).where(pd.notna(normalized), None)
    return normalized.to_dict(orient="records")


@router.post("/upload-erp-export", status_code=status.HTTP_201_CREATED)
async def upload_erp_export(file: UploadFile = File(...)) -> dict[str, Any]:
    """Normalize a KMU ERP export (CSV/XLSX) into validated DPP drafts."""
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Filename missing."
        )

    frame = _read_dataframe(file.filename, await file.read())
    rows = _normalize_rows(frame)

    drafts: list[dict[str, Any]] = []
    row_errors: list[dict[str, Any]] = []
    for index, row in enumerate(rows):
        try:
            draft = ProductPassportDraft(**row)
        except ValidationError as exc:
            row_errors.append(
                {
                    "row": index + 2,  # +2 → 1-based & header row, matches Excel view
                    "errors": exc.errors(include_url=False, include_context=False),
                }
            )
            continue
        drafts.append(draft.model_dump(mode="json"))

    if row_errors:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"source": "kmu_upload", "row_errors": row_errors},
        )

    return {"count": len(drafts), "items": drafts}
