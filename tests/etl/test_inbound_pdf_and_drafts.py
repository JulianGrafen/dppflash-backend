"""Tests for draft listing and PDF extract endpoint."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from etl.http_service import app
from etl.models.dpp_schemas import DPPAnalysisResult, ExtractionMetadata, ProductCategory

client = TestClient(app)


def test_list_drafts_empty() -> None:
    response = client.get("/api/v1/dpp/drafts?tenant_id=test-tenant")

    assert response.status_code == 200
    body = response.json()
    assert body["tenant_id"] == "test-tenant"
    assert body["count"] == 0


@patch("etl.dpp_flash.inbound.pdf_extract._build_extractor")
def test_pdf_extract_returns_json(mock_build: MagicMock) -> None:
    mock_extractor = MagicMock()
    mock_build.return_value = mock_extractor
    mock_extractor.extract.return_value = DPPAnalysisResult(
        product_category=ProductCategory.GENERIC,
        metadata=ExtractionMetadata(source_filename="test.pdf"),
    )

    response = client.post(
        "/api/v1/extract/pdf",
        files={"file": ("sample.pdf", b"%PDF-1.4", "application/pdf")},
        data={"tenant_id": "tenant-pdf", "persist": "false"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["tenant_id"] == "tenant-pdf"
    assert body["draft"]["upi"] == "PDF-sample"
    assert body["match_status"] == "unmatched"
    assert body["extraction"]["product_category"] == "GENERIC"


def test_pdf_extract_rejects_non_pdf() -> None:
    response = client.post(
        "/api/v1/extract/pdf",
        files={"file": ("notes.txt", b"hello", "text/plain")},
    )

    assert response.status_code == 400
