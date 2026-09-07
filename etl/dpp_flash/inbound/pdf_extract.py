"""PDF → JSON extraction endpoint (inbound funnel)."""

from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel

from etl.dpp_flash.inbound.extraction_mapper import analysis_result_to_passport_draft
from etl.dpp_flash.inbound.fusion_service import try_auto_match_and_fuse
from etl.dpp_flash.inbound.models import ProductPassportDraft
from etl.dpp_flash.inbound.product_matcher import MatchReason
from etl.dpp_flash.inbound.repository import DppDraftRepository, get_dpp_draft_repository
from etl.dpp_flash.inbound.validation_service import persist_with_validation
from etl.graph.nodes.extractor import _build_extractor
from etl.services.dpp_extractor import LLMExtractionError, PDFReadError

router = APIRouter(prefix="/api/v1/extract", tags=["pdf-extraction"])

_PDF_SUFFIXES = (".pdf",)


class PdfExtractResponse(BaseModel):
    """Full extraction JSON plus normalized draft; may be fused into a master product."""

    draft: ProductPassportDraft
    extraction: dict[str, Any]
    stored: dict[str, Any] | None = None
    tenant_id: str
    match_status: Literal["enriched", "unmatched"]
    matched_master_upi: str | None = None
    matched_by: MatchReason | None = None
    readiness_score_percent: float | None = None
    gap_count: int | None = None


@router.post("/pdf", response_model=PdfExtractResponse, status_code=status.HTTP_201_CREATED)
async def extract_pdf(
    file: UploadFile = File(...),
    tenant_id: str = Form(default="default"),
    persist: bool = Form(default=True),
    repository: DppDraftRepository = Depends(get_dpp_draft_repository),
) -> PdfExtractResponse:
    """Extract ESPR fields from a PDF and match/fuse into an Excel master when possible."""
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
    match_status: Literal["enriched", "unmatched"] = "unmatched"
    matched_master_upi: str | None = None
    matched_by: MatchReason | None = None

    readiness_score_percent: float | None = None
    gap_count: int | None = None

    if persist:
        existing = repository.list_dpp_drafts(tenant_id=tenant_id, limit=500)
        row_to_store, reason, master_upi = try_auto_match_and_fuse(
            draft,
            tenant_id,
            existing,
            raw_extraction=extraction_json,
        )
        stored, validation = persist_with_validation(
            repository,
            row_to_store,
            ProductPassportDraft(**(row_to_store.get("payload") or {})),
            raw_extraction=extraction_json,
        )
        readiness_score_percent = validation.readiness_score_percent
        gap_count = validation.gap_count
        if master_upi and reason != "none":
            match_status = "enriched"
            matched_master_upi = master_upi
            matched_by = reason
        else:
            match_status = "unmatched"

    return PdfExtractResponse(
        draft=draft,
        extraction=extraction_json,
        stored=stored,
        tenant_id=tenant_id,
        match_status=match_status,
        matched_master_upi=matched_master_upi,
        matched_by=matched_by,
        readiness_score_percent=readiness_score_percent,
        gap_count=gap_count,
    )
