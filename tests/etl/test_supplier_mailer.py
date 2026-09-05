"""Tests for supplier outreach mailer."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from etl.graph.state import GapRecord
from etl.services.mailer import (
    build_supplier_gap_request_body,
    send_supplier_gap_request_email,
)
from etl.services.enrichment import send_supplier_outreach
from etl.models.audit_field import AuditField
from etl.models.dpp_schemas import DPPAnalysisResult, ProductCategory
from tests.etl.test_sap_product_odata_ingest import SAMPLE_A_PRODUCT

OUTREACH_SECRET = "test-secret-key-for-magic-link"


@pytest.fixture(autouse=True)
def _outreach_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SUPPLIER_OUTREACH_SECRET", OUTREACH_SECRET)
    monkeypatch.setenv("NEXT_PUBLIC_DPP_URL", "https://app.example.com")


def test_build_supplier_gap_request_body_lists_gaps() -> None:
    magic_link = "https://app.example.com/supplier/outreach/token.sig"
    body = build_supplier_gap_request_body(
        product_identifier="SKU-1",
        supplier_name="Covestro Deutschland AG",
        gaps=[
            GapRecord(
                field_path="sustainability.environmental_footprint",
                reason="Missing LCA data.",
            )
        ],
        magic_link=magic_link,
    )
    assert "Covestro" in body
    assert "sustainability.environmental_footprint" in body
    assert "SKU-1" in body
    assert magic_link in body


def test_build_supplier_gap_request_html_includes_button() -> None:
    from etl.services.mailer import build_supplier_gap_request_html

    magic_link = "https://app.example.com/supplier/outreach/token.sig"
    html = build_supplier_gap_request_html(
        product_identifier="SKU-1",
        supplier_name="Covestro",
        gaps=[],
        magic_link=magic_link,
    )
    assert "Daten jetzt einreichen" in html
    assert magic_link in html


def test_send_supplier_gap_request_email_dry_run_by_default(monkeypatch) -> None:
    monkeypatch.delenv("SUPPLIER_OUTREACH_ENABLED", raising=False)
    monkeypatch.delenv("SMTP_HOST", raising=False)

    result = send_supplier_gap_request_email(
        to_address="stefan.meier@covestro.corp",
        product_identifier="000000000010048921",
        supplier_name="Covestro Deutschland AG",
        gaps=[],
    )

    assert result.success is True
    assert result.mode == "dry_run"
    assert result.recipient == "stefan.meier@covestro.corp"


def test_send_supplier_gap_request_email_smtp(monkeypatch) -> None:
    monkeypatch.setenv("SUPPLIER_OUTREACH_ENABLED", "true")
    monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
    monkeypatch.setenv("SMTP_PORT", "587")
    monkeypatch.setenv("SMTP_USER", "user")
    monkeypatch.setenv("SMTP_PASSWORD", "pass")
    monkeypatch.setenv("SUPPLIER_OUTREACH_FROM", "dpp@example.com")

    mock_smtp = MagicMock()
    mock_server = MagicMock()
    mock_smtp.return_value.__enter__.return_value = mock_server

    with patch("etl.services.mailer.smtplib.SMTP", mock_smtp):
        result = send_supplier_gap_request_email(
            to_address="stefan.meier@covestro.corp",
            product_identifier="SKU-1",
            supplier_name="Covestro",
            gaps=[],
        )

    assert result.success is True
    assert result.mode == "smtp"
    mock_server.starttls.assert_called_once()
    mock_server.login.assert_called_once_with("user", "pass")
    mock_server.send_message.assert_called_once()


def test_send_supplier_gap_request_email_smtp_ssl_port_465(monkeypatch) -> None:
    monkeypatch.setenv("SUPPLIER_OUTREACH_ENABLED", "true")
    monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
    monkeypatch.setenv("SMTP_PORT", "465")
    monkeypatch.setenv("SMTP_USER", "user")
    monkeypatch.setenv("SMTP_PASSWORD", "pass")
    monkeypatch.setenv("SUPPLIER_OUTREACH_FROM", "dpp@example.com")

    mock_ssl = MagicMock()
    mock_server = MagicMock()
    mock_ssl.return_value.__enter__.return_value = mock_server

    with patch("etl.services.mailer.smtplib.SMTP_SSL", mock_ssl):
        result = send_supplier_gap_request_email(
            to_address="stefan.meier@covestro.corp",
            product_identifier="SKU-1",
            supplier_name="Covestro",
            gaps=[],
        )

    assert result.success is True
    mock_ssl.assert_called_once()
    mock_server.login.assert_called_once_with("user", "pass")


def test_send_supplier_outreach_keeps_magic_link_when_smtp_fails(monkeypatch) -> None:
    monkeypatch.setenv("SUPPLIER_OUTREACH_ENABLED", "true")
    monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
    monkeypatch.setenv("SMTP_PORT", "587")
    monkeypatch.setenv("SMTP_USER", "user")
    monkeypatch.setenv("SMTP_PASSWORD", "pass")
    monkeypatch.setenv("SUPPLIER_OUTREACH_FROM", "dpp@example.com")

    with patch("etl.services.mailer._send_via_smtp", side_effect=OSError("Connection unexpectedly closed")):
        result = send_supplier_outreach(
            extracted_data=DPPAnalysisResult(product_category=ProductCategory.GENERIC),
            gaps=[GapRecord(field_path="sustainability.resource_use", reason="missing")],
            product_identifier="000000000010048921",
            sap_export=SAMPLE_A_PRODUCT,
        )

    assert result.success is True
    assert result.notes is not None
    assert "[SMTP failed]" in result.notes
    assert "Magic link:" in result.notes
    assert "/supplier/outreach/" in result.notes


def test_send_supplier_outreach_integrates_mailer(monkeypatch) -> None:
    monkeypatch.delenv("SUPPLIER_OUTREACH_ENABLED", raising=False)

    result = send_supplier_outreach(
        extracted_data=DPPAnalysisResult(product_category=ProductCategory.GENERIC),
        gaps=[
            GapRecord(field_path="sustainability.resource_use", reason="missing"),
        ],
        product_identifier="000000000010048921",
        sap_export=SAMPLE_A_PRODUCT,
    )

    assert result.success is True
    assert result.notes is not None
    assert "stefan.meier@covestro.corp" in result.notes
    assert "Dry-Run" in result.notes
    assert "Magic link:" in result.notes
    assert "/supplier/outreach/" in result.notes
