"""KMU ingest — Excel/CSV ERP exports for the DPP funnel."""

from __future__ import annotations

import io
import re
from typing import Any

import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import ValidationError

from etl.dpp_flash.inbound.fusion_service import build_master_row
from etl.dpp_flash.inbound.models import ProductPassportDraft
from etl.dpp_flash.inbound.repository import DppDraftRepository, get_dpp_draft_repository
from etl.dpp_flash.inbound.validation_service import persist_with_validation

router = APIRouter(prefix="/api/v1/kmu", tags=["kmu-ingestion"])

# Canonical field → accepted header labels (German + English ERP/SAP/retail exports).
KMU_COLUMN_ALIASES: dict[str, tuple[str, ...]] = {
    "upi": (
        # German — ERP / SAP / DATEV
        "Artikelnummer",
        "Artikel-Nr",
        "Art.-Nr.",
        "Art.-Nr",
        "Artikel Nr",
        "Artikel-Nr.",
        "Artikel Nummer",
        "Artikelnr",
        "Artikelnr.",
        "Artnr",
        "Artnr.",
        "Art-Nr",
        "Art Nr",
        "Materialnummer",
        "Material-Nr",
        "Material-Nr.",
        "Material Nr",
        "Materialnummer SAP",
        "MATNR",
        "Mat.-Nr.",
        "Warennummer",
        "Produktnummer",
        "Produkt-Nr",
        "Produkt-Nr.",
        "Produkt Nr",
        "Produktcode",
        "Produkt-Code",
        "Produkt ID",
        "Produkt-ID",
        "Teilenummer",
        "Teile-Nr",
        "Referenznummer",
        "Ref.-Nr.",
        "Ref Nr",
        "Interne Nummer",
        "Interne Artikelnummer",
        "Bestellnummer",
        "Bestell-Nr",
        "Katalognummer",
        "Katalog-Nr",
        "Lieferanten-Artikelnummer",
        "Lieferantenartikelnummer",
        "Hersteller-Artikelnummer",
        "Herstellerartikelnummer",
        "Modellnummer",
        "Modell-Nr",
        "Variante",
        "Varianten-SKU",
        "Sachnummer",
        "Identnummer",
        "Identifikationsnummer",
        "Eindeutige Produktkennung",
        # English — ERP / PIM / e-commerce
        "SKU",
        "UPI",
        "Product ID",
        "Product-ID",
        "Product Id",
        "Product Code",
        "Product Number",
        "Product No",
        "Product No.",
        "Item Number",
        "Item No",
        "Item No.",
        "Item ID",
        "Item-ID",
        "Item Code",
        "Article Number",
        "Article No",
        "Article No.",
        "Article Code",
        "Article ID",
        "Material Number",
        "Material No",
        "Material ID",
        "Material Code",
        "Part Number",
        "Part No",
        "Part No.",
        "Catalog Number",
        "Catalog No",
        "Catalog No.",
        "Internal SKU",
        "Internal Product Code",
        "Supplier Part Number",
        "Manufacturer Part Number",
        "MPN",
        "Model Number",
        "Model No",
        "Variant SKU",
        "Unique Product Identifier",
        "Unique Product ID",
    ),
    "gtin": ("GTIN", "EAN", "EAN-13", "EAN13", "Barcode"),
    "weight": ("Gewicht (kg)", "Gewicht", "Weight (kg)", "Weight", "Masse (kg)", "Masse"),
    "hersteller": (
        "Hersteller",
        "Herstellername",
        "Manufacturer",
        "Manufacturer Name",
        "Lieferant",
    ),
    "herstelleradresse": (
        "Herstelleradresse",
        "Manufacturer Address",
        "Adresse",
        "Anschrift",
        "Hersteller Adresse",
    ),
    "eori": ("EORI", "EORI-Nummer", "EORI Number", "EORI-Nr", "EORI Nr"),
    "kontakt_name": (
        "Kontakt",
        "Ansprechpartner",
        "Kontaktperson",
        "Contact",
        "Contact Name",
    ),
    "kontakt_email": (
        "E-Mail",
        "Email",
        "Kontakt E-Mail",
        "Kontakt Email",
        "Mail",
    ),
    "kontakt_phone": (
        "Telefon",
        "Phone",
        "Kontakt Telefon",
        "Tel",
        "Telefonnummer",
    ),
    "manufacturer_address": (
        "Herstelleradresse (legacy)",
    ),
    "disposal_instructions": (
        "Entsorgungshinweise",
        "Entsorgung",
        "Disposal Instructions",
        "Disposal",
    ),
}

_CSV_SUFFIXES = (".csv",)
_EXCEL_SUFFIXES = (".xlsx", ".xls")


def _normalize_header(value: object) -> str:
    """Case-insensitive, whitespace-collapsed header key for alias lookup."""
    text = str(value).strip()
    text = re.sub(r"\s+", " ", text)
    return text.casefold()


def _compact_header(value: object) -> str:
    """Punctuation-insensitive key — matches Art.-Nr. ≈ Art Nr ≈ artnr."""
    return re.sub(r"[\s.\-_/():#,]+", "", _normalize_header(value))


def _header_keys(value: object) -> tuple[str, str]:
    return _normalize_header(value), _compact_header(value)


def _build_header_lookup() -> dict[str, str]:
    lookup: dict[str, str] = {}
    for field, labels in KMU_COLUMN_ALIASES.items():
        for label in labels:
            for key in _header_keys(label):
                lookup[key] = field
    return lookup


_HEADER_LOOKUP = _build_header_lookup()


def _resolve_canonical_field(column: object) -> str | None:
    for key in _header_keys(column):
        if key in _HEADER_LOOKUP:
            return _HEADER_LOOKUP[key]
    return None


def _canonical_column_names(frame: pd.DataFrame) -> dict[str, str]:
    """Map original DataFrame columns to canonical inbound field names."""
    mapping: dict[str, str] = {}
    for column in frame.columns:
        canonical = _resolve_canonical_field(column)
        if canonical and canonical not in mapping.values():
            mapping[str(column)] = canonical
    return mapping


def _read_dataframe(filename: str, content: bytes) -> pd.DataFrame:
    buffer = io.BytesIO(content)
    lowered = filename.lower()
    try:
        if lowered.endswith(_CSV_SUFFIXES):
            sample = content[:4096].decode("utf-8-sig", errors="replace")
            separator = ";" if sample.count(";") > sample.count(",") else ","
            buffer.seek(0)
            return pd.read_csv(buffer, dtype=str, sep=separator)
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
    column_map = _canonical_column_names(frame)
    if "upi" not in column_map.values():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "No known columns found in upload.",
                "hint": (
                    "At least one product-id column is required "
                    "(e.g. Artikelnummer, SKU, Materialnummer, Product ID, MATNR)."
                ),
                "found_columns": [str(column) for column in frame.columns],
                "accepted_columns": KMU_COLUMN_ALIASES,
            },
        )

    source_columns = list(column_map.keys())
    normalized = frame[source_columns].rename(columns=column_map)
    normalized = normalized.astype(object).where(pd.notna(normalized), None)
    return normalized.to_dict(orient="records")


def resolve_canonical_field(column: object) -> str | None:
    """Public alias for staging normalization."""
    return _resolve_canonical_field(column)


def assemble_draft_row(row: dict[str, Any]) -> dict[str, Any]:
    """Public alias for staging normalization."""
    return _assemble_draft_row(row)


def _assemble_draft_row(row: dict[str, Any]) -> dict[str, Any]:
    """Map flat Excel kontakt columns into nested Contact and drop helper keys."""
    payload = dict(row)
    kontakt_name = payload.pop("kontakt_name", None)
    kontakt_email = payload.pop("kontakt_email", None)
    kontakt_phone = payload.pop("kontakt_phone", None)
    if kontakt_name or kontakt_email or kontakt_phone:
        payload["kontakt"] = {
            "name": kontakt_name,
            "email": kontakt_email,
            "phone": kontakt_phone,
        }
    return payload


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
            draft = ProductPassportDraft(**assemble_draft_row(row))
        except ValidationError as exc:
            row_errors.append(
                {
                    "row": index + 2,
                    "errors": exc.errors(include_url=False, include_context=False),
                }
            )
            continue
        draft_json = draft.model_dump(mode="json")
        if persist:
            stored_row, validation = persist_with_validation(
                repository,
                build_master_row(draft, tenant_id, source="kmu_excel"),
                draft,
            )
            draft_json["readiness_score_percent"] = validation.readiness_score_percent
            draft_json["gap_count"] = validation.gap_count
            stored.append(stored_row)
        drafts.append(draft_json)

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
