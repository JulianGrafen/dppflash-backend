"""Tests for the DPP-Flash LangGraph scaffold."""

from __future__ import annotations

from etl.dpp_flash.graph import app, route_after_sap_enrichment, route_after_validation
from etl.dpp_flash.state import (
    ESCALATION_RETRY_LIMIT,
    STATUS_EMAIL_FOUND,
    STATUS_REQUIRES_HUMAN_INTERVENTION,
    initial_state,
)


VALID_SDS = """
Produktname: Cimsec Kleber S1
Hersteller: Muster GmbH
Abschnitt 3: Quarz 50%, Zement 30%, Wasser 20%
CO2: 2.4 kg
"""


def test_route_valid_goes_to_end() -> None:
    assert route_after_validation({"is_valid": True}) == "end"  # type: ignore[arg-type]


def test_route_invalid_goes_to_sap() -> None:
    assert route_after_validation({"is_valid": False}) == "sap_enrichment"  # type: ignore[arg-type]


def test_route_sap_email_found_goes_to_outreach() -> None:
    state = {"email_found": True, "retry_count": 0}
    assert route_after_sap_enrichment(state) == "supplier_outreach"  # type: ignore[arg-type]


def test_route_sap_no_email_goes_to_human() -> None:
    state = {"email_found": False, "retry_count": 0}
    assert route_after_sap_enrichment(state) == "human_escalation"  # type: ignore[arg-type]


def test_route_retry_limit_goes_to_human() -> None:
    state = {"email_found": True, "retry_count": ESCALATION_RETRY_LIMIT}
    assert route_after_sap_enrichment(state) == "human_escalation"  # type: ignore[arg-type]


def test_route_requires_human_intervention_status() -> None:
    state = {"status": STATUS_REQUIRES_HUMAN_INTERVENTION, "email_found": False}
    assert route_after_sap_enrichment(state) == "human_escalation"  # type: ignore[arg-type]


def test_happy_path_graph_invoke() -> None:
    result = app.invoke(
        initial_state(product_id="SKU-670689", raw_document=VALID_SDS),
    )
    assert result["is_valid"] is True
    assert result["status"] == "validated"
    assert result["extracted_data"].get("product_name")


def test_invalid_mass_balance_triggers_enrichment() -> None:
    bad_sds = """
    Produktname: Test
    Hersteller: Muster GmbH
    Abschnitt 3: Quarz 50%, Zement 30%
    CO2: 1.0 kg
    """
    result = app.invoke(initial_state(product_id="SKU-BAD", raw_document=bad_sds))
    assert result["is_valid"] is False
    assert result["status"] in {
        "awaiting_supplier_response",
        "pending_human_review",
        STATUS_EMAIL_FOUND,
        STATUS_REQUIRES_HUMAN_INTERVENTION,
    }
