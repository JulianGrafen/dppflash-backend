"""Integration tests for POST /api/v1/kmu/upload-erp-export."""

from __future__ import annotations

import io

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from etl.http_service import app

client = TestClient(app)

VALID_ROWS = [
    {
        "Artikelnummer": "KMU-1001",
        "GTIN": "4006381333931",
        "Gewicht (kg)": "12.5",
        "Herstelleradresse": "Musterstraße 1, 12345 Berlin",
        "Entsorgungshinweise": "Restmüll",
    },
    {
        "Artikelnummer": "KMU-1003",
        "GTIN": "4098765432109",
        "Gewicht (kg)": None,  # NaN → None path
        "Herstelleradresse": None,
        "Entsorgungshinweise": None,
    },
]


def _kmu_upload(filename: str, content: bytes, tenant_id: str = "tenant-1") -> object:
    return client.post(
        "/api/v1/kmu/upload-erp-export",
        files={"file": (filename, content, "application/octet-stream")},
        data={"tenant_id": tenant_id},
    )


def _upload(filename: str, content: bytes) -> object:
    return _kmu_upload(filename, content)


def _xlsx_bytes(rows: list[dict[str, object]]) -> bytes:
    buffer = io.BytesIO()
    pd.DataFrame(rows).to_excel(buffer, index=False)
    return buffer.getvalue()


def _csv_bytes(rows: list[dict[str, object]]) -> bytes:
    buffer = io.StringIO()
    pd.DataFrame(rows).to_csv(buffer, index=False)
    return buffer.getvalue().encode()


def test_xlsx_upload_normalizes_and_validates() -> None:
    response = _upload("export.xlsx", _xlsx_bytes(VALID_ROWS))

    assert response.status_code == 201
    body = response.json()
    assert body["count"] == 2
    first, second = body["items"]
    assert first["upi"] == "KMU-1001"
    assert first["gtin"] == "4006381333931"  # not mangled into a float
    assert first["weight"] == "12.5"
    assert first["is_draft"] is True
    assert second["weight"] is None  # NaN converted to None
    assert second["manufacturer_address"] is None


def test_csv_upload_works() -> None:
    response = _upload("export.csv", _csv_bytes(VALID_ROWS))

    assert response.status_code == 201
    assert response.json()["count"] == 2


def test_unsupported_format_yields_400() -> None:
    response = _upload("export.pdf", b"%PDF-1.4 nonsense")

    assert response.status_code == 400
    assert "Unsupported file format" in response.json()["detail"]


def test_unknown_columns_yield_400() -> None:
    rows = [{"Foo": "1", "Bar": "2"}]

    response = _upload("export.csv", _csv_bytes(rows))

    assert response.status_code == 400
    detail = response.json()["detail"]
    assert "accepted_columns" in detail
    assert "found_columns" in detail


def test_sku_alias_maps_to_upi() -> None:
    rows = [
        {
            "SKU": "KMU-ALIAS-1",
            "GTIN": "4006381333931",
            "Weight": "2.0",
        },
    ]

    response = _upload("export.csv", _csv_bytes(rows))

    assert response.status_code == 201
    assert response.json()["items"][0]["upi"] == "KMU-ALIAS-1"


def test_german_csv_semicolon_separator() -> None:
    content = (
        "Artikelnummer;GTIN;Gewicht (kg)\n"
        "KMU-DE-1;4006381333931;5.0\n"
    ).encode()

    response = _upload("export.csv", content)

    assert response.status_code == 201
    assert response.json()["items"][0]["upi"] == "KMU-DE-1"


@pytest.mark.parametrize(
    "header",
    [
        "SKU",
        "Produkt ID",
        "Produkt-ID",
        "Art.-Nr.",
        "MATNR",
        "Product ID",
        "Material-Nr.",
        "Manufacturer Part Number",
        "Interne Artikelnummer",
        "Unique Product Identifier",
    ],
)
def test_upi_aliases_accept_common_erp_headers(header: str) -> None:
    rows = [{header: "KMU-ALIAS-X", "GTIN": "4006381333931"}]

    response = _upload("export.csv", _csv_bytes(rows))

    assert response.status_code == 201
    assert response.json()["items"][0]["upi"] == "KMU-ALIAS-X"


def test_invalid_row_reports_excel_row_number() -> None:
    rows = [
        VALID_ROWS[0],
        {"Artikelnummer": "KMU-BAD", "GTIN": "not-a-gtin"},  # Excel row 3
    ]

    response = _upload("export.xlsx", _xlsx_bytes(rows))

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert detail["source"] == "kmu_upload"
    assert detail["row_errors"][0]["row"] == 3


def test_missing_upi_row_rejected() -> None:
    rows = [{"Artikelnummer": "", "GTIN": "4006381333931", "Gewicht (kg)": "1.0"}]

    response = _upload("export.csv", _csv_bytes(rows))

    assert response.status_code == 422
