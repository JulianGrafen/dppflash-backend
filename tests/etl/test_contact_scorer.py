"""Unit tests for ContactScorer SAP OData e-mail selection."""

from __future__ import annotations

from etl.models.audit_field import SourceSystem
from etl.services.contact_scorer import ContactScorer


def test_only_blacklisted_invoice_returns_none() -> None:
    scorer = ContactScorer()
    result = scorer.get_best_contact(
        {
            "DefaultEmailAddress": "rechnungseingang@supplier.example",
        }
    )
    assert result is None


def test_technical_sales_beats_default_info() -> None:
    scorer = ContactScorer()
    result = scorer.get_best_contact(
        {
            "DefaultEmailAddress": "info@supplier.example",
            "to_ContactPerson": [
                {
                    "FirstName": "Anna",
                    "LastName": "Schmidt",
                    "Department": "Technical Sales",
                    "EmailAddress": "anna.schmidt@supplier.example",
                }
            ],
        }
    )
    assert result is not None
    assert result.value == "anna.schmidt@supplier.example"
    assert result.source_system == SourceSystem.SAP_VENDOR_MASTER.value
    assert result.source_detail is not None
    assert "Anna Schmidt" in result.source_detail
    assert "Technical Sales" in result.source_detail
    assert "score=50" in result.source_detail


def test_personal_email_without_dept_beats_default() -> None:
    scorer = ContactScorer()
    result = scorer.get_best_contact(
        {
            "DefaultEmailAddress": "info@supplier.example",
            "to_ContactPerson": [
                {
                    "FirstName": "Max",
                    "LastName": "Mustermann",
                    "Department": None,
                    "EmailAddress": "max.mustermann@supplier.example",
                }
            ],
        }
    )
    assert result is not None
    assert result.value == "max.mustermann@supplier.example"
    assert result.source_detail is not None
    assert "score=20" in result.source_detail


def test_blacklisted_contact_despite_department_escalates_when_alone() -> None:
    scorer = ContactScorer()
    result = scorer.get_best_contact(
        {
            "to_ContactPerson": [
                {
                    "FirstName": "AP",
                    "LastName": "Desk",
                    "Department": "Compliance",
                    "EmailAddress": "ap-invoices@supplier.example",
                }
            ],
        }
    )
    assert result is None


def test_blacklisted_contact_falls_through_to_default() -> None:
    scorer = ContactScorer()
    result = scorer.get_best_contact(
        {
            "DefaultEmailAddress": "info@supplier.example",
            "to_ContactPerson": [
                {
                    "FirstName": "AP",
                    "LastName": "Desk",
                    "Department": "Sales",
                    "EmailAddress": "buchhaltung@supplier.example",
                }
            ],
        }
    )
    assert result is not None
    assert result.value == "info@supplier.example"
    assert result.source_detail is not None
    assert "DefaultEmailAddress" in result.source_detail
    assert "score=5" in result.source_detail


def test_odata_results_wrapper() -> None:
    scorer = ContactScorer()
    result = scorer.get_best_contact(
        {
            "DefaultEmailAddress": "info@supplier.example",
            "to_ContactPerson": {
                "results": [
                    {
                        "FirstName": "Eva",
                        "LastName": "Quality",
                        "Department": "Quality Assurance",
                        "EmailAddress": "eva.quality@supplier.example",
                    }
                ]
            },
        }
    )
    assert result is not None
    assert result.value == "eva.quality@supplier.example"
    assert result.source_detail is not None
    assert "score=50" in result.source_detail


def test_empty_and_invalid_payloads_return_none() -> None:
    scorer = ContactScorer()
    assert scorer.get_best_contact({}) is None
    assert scorer.get_best_contact({"DefaultEmailAddress": "not-an-email"}) is None
    assert scorer.get_best_contact({"to_ContactPerson": []}) is None


def test_noreply_default_alone_returns_none() -> None:
    scorer = ContactScorer()
    assert scorer.get_best_contact({"DefaultEmailAddress": "noreply@supplier.example"}) is None


def test_source_detail_contains_score_and_sap_path() -> None:
    scorer = ContactScorer()
    result = scorer.get_best_contact(
        {
            "to_ContactPerson": [
                {
                    "FirstName": "Tom",
                    "LastName": "Green",
                    "Department": "Sustainability",
                    "EmailAddress": "tom.green@supplier.example",
                }
            ],
        }
    )
    assert result is not None
    assert "(score=" in (result.source_detail or "")
    assert "to_ContactPerson" in (result.source_detail or "")
