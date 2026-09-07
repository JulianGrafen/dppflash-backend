"""PDF → JSON extraction endpoint (inbound funnel)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel

from etl.dpp_flash.inbound.extraction_mapper import analysis_result_to_passport_draft
from etl.dpp_flash.inbound.models import ProductPassportDraft
from etl.dpp_flash.inbound.repository import DppDraftRepository, get_dpp_draft_repository
from etl.graph.nodes.extractor import _build_extractor
from etl.services.dpp_extractor import LLMExtractionError, PDFReadError

router = APIRouter(prefix="/api/v1/extract", tags=["pdf-extraction"])

_PDF_SUFFIXES = (".pdf",)


class PdfExtractResponse(BaseModel):
    """Full extraction JSON plus normalized draft stored in Supabase."""

    draft: ProductPassportDraft
    extraction: dict[str, Any]
    stored: dict[str, Any] | None = None
    tenant_id: str


@router.post("/pdf", response_model=PdfExtractResponse, status_code=status.HTTP_201_CREATED)
async def extract_pdf(
    file: UploadFile = File(...),
    tenant_id: str = Form(default="default"),
    persist: bool = Form(default=True),
    repository: DppDraftRepository = Depends(get_dpp_draft_repository),
) -> PdfExtractResponse:
    """Extract ESPR fields from a PDF and optionally persist the draft."""
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Filename missing.")
    if not file.filename.lower().endswith(_PDF_SUFFIXES):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file format. Expected .pdf.",
        )

    pdf_bytes = await file.read()
    if not pdf_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file.")

    try:
        extractor = _build_extractor()
        analysis = extractor.extract(pdf_bytes, filename=file.filename)
    except PDFReadError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except LLMExtractionError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    extraction_json = analysis.model_dump(mode="json")
    draft = analysis_result_to_passport_draft(analysis, file.filename)

    stored: dict[str, Any] | None = None
    if persist:
        stored = repository.save_dpp_draft(
            draft,
            tenant_id=tenant_id,
            source="pdf_extract",
            raw_extraction=extraction_json,
        )

    return PdfExtractResponse(
        draft=draft,
        extraction=extraction_json,
        stored=stored,
        tenant_id=tenant_id,
    )
