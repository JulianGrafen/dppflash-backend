"""LangSmith tracing configuration helpers."""

from __future__ import annotations

from etl.services.tracing import langsmith_config_status


def test_langsmith_config_status_inactive_without_key(monkeypatch) -> None:
    monkeypatch.delenv("LANGSMITH_API_KEY", raising=False)
    monkeypatch.setenv("LANGSMITH_TRACING", "true")
    status = langsmith_config_status()
    assert status["langsmith_tracing_flag"] is True
    assert status["langsmith_api_key_configured"] is False
    assert status["langsmith_tracing_active"] is False


def test_langsmith_config_status_active(monkeypatch) -> None:
    monkeypatch.setenv("LANGSMITH_TRACING", "true")
    monkeypatch.setenv("LANGSMITH_API_KEY", "lsv2_test")
    monkeypatch.setenv("LANGSMITH_ENDPOINT", "https://eu.api.smith.langchain.com")
    monkeypatch.setenv("LANGSMITH_PROJECT", "pr-artistic-marmalade-30")
    status = langsmith_config_status()
    assert status["langsmith_tracing_active"] is True
    assert status["langsmith_endpoint"] == "https://eu.api.smith.langchain.com"
    assert status["langsmith_project"] == "pr-artistic-marmalade-30"
