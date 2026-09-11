"""Integration tests for inbound staging ingest endpoints."""

from __future__ import annotations

import io
import uuid

import pandas as pd
from fastapi.testclient import TestClient

from etl.http_service import app

client = TestClient(app)


def _csv_bytes(rows: list[dict[str, object]]) -> bytes:
    buffer = io.StringIO()
    pd.DataFrame(rows).to_csv(buffer, index=False)
    return buffer.getvalue().encode()


def test_webhook_ingest_auto_merges_to_processed() -> None:
    tenant = f"wh-{uuid.uuid4().hex[:8]}"
    response = client.post(
        "/api/v1/inbound/ingest/webhook",
        json={"tenant_id": tenant, "SKU": "WH-001", "Name": "Webhook Product"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["tenant_id"] == tenant
    assert body["event"]["status"] == "PROCESSED"
    assert body["event"]["extracted_upi"] == "WH-001"
    assert body["event"]["merged_upi"] == "WH-001"


def test_webhook_orphan_without_anchor() -> None:
    tenant = f"orphan-{uuid.uuid4().hex[:8]}"
    response = client.post(
        f"/api/v1/inbound/ingest/webhook?tenant_id={tenant}",
        json={"description": "no id"},
    )
    assert response.status_code == 201
    assert response.json()["event"]["status"] == "ORPHAN"
    assert response.json()["event"]["extracted_upi"] is None


def test_file_ingest_creates_one_event_per_row() -> None:
    tenant = f"file-{uuid.uuid4().hex[:8]}"
    rows = [
        {"SKU": "FILE-1", "EAN": "4006381333931"},
        {"Title": "No SKU row"},
    ]
    response = client.post(
        "/api/v1/inbound/ingest/file",
        data={"tenant_id": tenant},
        files={"file": ("export.csv", _csv_bytes(rows), "text/csv")},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["count"] == 2
    assert body["items"][0]["status"] == "PROCESSED"
    assert body["items"][0]["extracted_upi"] == "FILE-1"
    assert body["items"][1]["status"] == "ORPHAN"


def test_duplicate_webhook_marks_conflict_when_open_pending() -> None:
    tenant = f"dup-{uuid.uuid4().hex[:8]}"
    client.post(
        "/api/v1/inbound/ingest/webhook",
        json={"tenant_id": tenant, "SKU": "DUP-SKU", "gtin": "not-valid-gtin"},
    )
    response = client.post(
        "/api/v1/inbound/ingest/webhook",
        json={"tenant_id": tenant, "SKU": "DUP-SKU", "Name": "Second"},
    )
    assert response.status_code == 201
    assert response.json()["event"]["status"] == "CONFLICT"


def test_list_staging_events() -> None:
    tenant = f"list-{uuid.uuid4().hex[:8]}"
    client.post(
        "/api/v1/inbound/ingest/webhook",
        json={"tenant_id": tenant, "SKU": "L-1"},
    )
    response = client.get(f"/api/v1/inbound/staging/events?tenant_id={tenant}")
    assert response.status_code == 200
    assert response.json()["count"] >= 1
