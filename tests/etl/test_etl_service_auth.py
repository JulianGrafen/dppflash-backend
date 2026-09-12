from __future__ import annotations

import os

from etl.services.etl_service_auth import resolve_openai_for_inbound_request


def test_resolve_prefers_etl_env(monkeypatch) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "sk-etl")
    assert resolve_openai_for_inbound_request(None, "sk-forwarded") == "sk-etl"


def test_resolve_accepts_forwarded_with_bearer(monkeypatch) -> None:
    monkeypatch.setattr(
        "etl.services.etl_service_auth.resolve_openai_api_key",
        lambda: None,
    )
    monkeypatch.setenv("ETL_SERVICE_SECRET", "test-secret")
    assert (
        resolve_openai_for_inbound_request("Bearer test-secret", "sk-forwarded")
        == "sk-forwarded"
    )


def test_resolve_rejects_forwarded_without_bearer(monkeypatch) -> None:
    monkeypatch.setattr(
        "etl.services.etl_service_auth.resolve_openai_api_key",
        lambda: None,
    )
    monkeypatch.setenv("ETL_SERVICE_SECRET", "test-secret")
    assert resolve_openai_for_inbound_request(None, "sk-forwarded") is None
