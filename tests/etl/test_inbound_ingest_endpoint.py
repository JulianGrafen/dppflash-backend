"""Integration tests for POST /api/v1/dpp/ingest (funnel endpoint)."""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

from etl.dpp_flash.inbound.stammdaten_models import TenantStammdatenUpsert
from etl.dpp_flash.inbound.stammdaten_repository import _default_repo as stammdaten_repo
from etl.http_service import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def _seed_ingest_tenant_stammdaten() -> None:
    stammdaten_repo.upsert_stammdaten(
        "tenant-1",
        TenantStammdatenUpsert(
            hersteller="Muster GmbH",
            herstelleradresse="Musterstraße 1, 12345 Berlin",
            taric_code="34060000",
        ),
    )

SAP_PAYLOAD: dict[str, Any] = {
    "upi": "UPI-670689",
    "gtin": "4006381333931",
    "weight": None,
    "hersteller": "Muster GmbH",
    "manufacturer_name": "Muster GmbH",
    "taric_code": "34060000",
    "herstelleradresse": "Musterstraße 1, 12345 Berlin",
    "bom": [
        {
            "bom_number": "B1",
            "component_description": None,
            "supplier_contact": {"name": "SAP Supplier", "email": None},
        }
    ],
}

SDS_EXTRACT: dict[str, Any] = {
    "weight": "12.5 kg",
    "herstelleradresse": "WRONG — must not overwrite",
    "hersteller": "WRONG NAME",
    "safety_warnings": ["H315", "H319"],
    "bom": [
        {
            "bom_number": "B1",
            "component_description": "Quarz 50%",
            "supplier_contact": {"email": "supplier@example.com"},
        }
    ],
}


def _ingest(sap: dict[str, Any], sds: dict[str, Any] | None = None) -> Any:
    return client.post(
        "/api/v1/dpp/ingest",
        json={"sap_payload": sap, "sds_extract": sds or {}, "tenant_id": "tenant-1"},
    )


def test_ingest_fuses_master_and_enrichment() -> None:
    response = _ingest(SAP_PAYLOAD, SDS_EXTRACT)

    assert response.status_code == 201
    dpp = response.json()["dpp"]
    # Enrichment fills gaps …
    assert dpp["weight"] == "12.5 kg"
    assert dpp["safety_warnings"] == ["H315", "H319"]
    assert dpp["bom"][0]["component_description"] == "Quarz 50%"
    assert dpp["bom"][0]["supplier_contact"]["email"] == "supplier@example.com"
    # … but never overwrites master values.
    assert dpp["manufacturer_address"] is None
    assert dpp["hersteller"] == "Muster GmbH"
    assert dpp["herstelleradresse"] == "Musterstraße 1, 12345 Berlin"
    assert dpp["bom"][0]["supplier_contact"]["name"] == "SAP Supplier"
    assert dpp["is_draft"] is True


def test_ingest_without_enrichment_returns_master() -> None:
    response = _ingest(SAP_PAYLOAD)

    assert response.status_code == 201
    assert response.json()["dpp"]["upi"] == "UPI-670689"


def test_invalid_sap_payload_yields_422_with_source() -> None:
    response = _ingest({"gtin": "4006381333931"})  # upi missing

    assert response.status_code == 422
    assert response.json()["detail"]["source"] == "sap_payload"


def test_invalid_sds_extract_yields_422_with_source() -> None:
    response = _ingest(SAP_PAYLOAD, {"gtin": "not-a-gtin"})

    assert response.status_code == 422
    assert response.json()["detail"]["source"] == "sds_extract"


def test_missing_tenant_id_rejected() -> None:
    response = client.post("/api/v1/dpp/ingest", json={"sap_payload": SAP_PAYLOAD})

    assert response.status_code == 422
