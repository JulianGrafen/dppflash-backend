"""Tests for tenant Stammdaten API and apply-on-persist."""

from __future__ import annotations

from fastapi.testclient import TestClient

from etl.dpp_flash.inbound.stammdaten_models import TenantStammdatenUpsert
from etl.dpp_flash.inbound.stammdaten_repository import _default_repo
from etl.http_service import app

client = TestClient(app)


def test_upsert_and_apply_on_kmu_upload() -> None:
    tenant = "stamm-tenant-1"
    _default_repo.upsert_stammdaten(
        tenant,
        TenantStammdatenUpsert(
            hersteller="Tenant Hersteller GmbH",
            herstelleradresse="Hauptstr. 1",
            eori="DE123",
            taric_code="34060000",
        ),
    )

    import io

    import pandas as pd

    rows = [{"Artikelnummer": "P-1", "GTIN": "4006381333931", "Hersteller": "From Excel"}]
    buffer = io.BytesIO()
    pd.DataFrame(rows).to_csv(buffer, index=False)
    content = buffer.getvalue()

    response = client.post(
        "/api/v1/kmu/upload-erp-export",
        files={"file": ("x.csv", content, "text/csv")},
        data={"tenant_id": tenant},
    )
    assert response.status_code == 201
    item = response.json()["items"][0]
    assert item["hersteller"] == "Tenant Hersteller GmbH"
    assert item.get("eori") == "DE123"
