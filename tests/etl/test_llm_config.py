"""LLM backend resolution for PDF extraction."""

from __future__ import annotations

import pytest

from etl.services.llm_config import (
    build_extractor_config,
    llm_extractor_configured,
    normalize_azure_endpoint,
    resolve_azure_openai_config,
)


def test_normalize_azure_endpoint_strips_path() -> None:
    assert (
        normalize_azure_endpoint("https://my-resource.openai.azure.com/openai/deployments/foo")
        == "https://my-resource.openai.azure.com"
    )


def test_build_extractor_config_prefers_openai_over_azure(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    monkeypatch.setenv("AZURE_OPENAI_ENDPOINT", "https://x.openai.azure.com")
    monkeypatch.setenv("AZURE_OPENAI_API_KEY", "azure-key")
    monkeypatch.setenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o")

    config = build_extractor_config()
    assert config is not None
    assert config.openai_api_key == "sk-test"
    assert config.azure_endpoint is None


def test_build_extractor_config_azure_ignores_dpp_extractor_model(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("etl.services.llm_config.resolve_openai_api_key", lambda: None)
    monkeypatch.setenv("DPP_EXTRACTOR_MODEL", "gpt-4o-2024-08-06")
    monkeypatch.setenv("AZURE_OPENAI_ENDPOINT", "https://x.openai.azure.com")
    monkeypatch.setenv("AZURE_OPENAI_API_KEY", "azure-key")
    monkeypatch.setenv("AZURE_OPENAI_DEPLOYMENT", "my-foundry-deployment")

    config = build_extractor_config()
    assert config is not None
    assert config.model == "my-foundry-deployment"


def test_build_extractor_config_uses_azure_when_no_openai(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("etl.services.llm_config.resolve_openai_api_key", lambda: None)
    monkeypatch.setenv("AZURE_OPENAI_ENDPOINT", "https://x.openai.azure.com")
    monkeypatch.setenv("AZURE_OPENAI_API_KEY", "azure-key")
    monkeypatch.setenv("AZURE_OPENAI_DEPLOYMENT", "my-gpt4o-deployment")

    config = build_extractor_config()
    assert config is not None
    assert config.openai_api_key is None
    assert config.azure_endpoint == "https://x.openai.azure.com"
    assert config.model == "my-gpt4o-deployment"
    assert llm_extractor_configured()
    assert resolve_azure_openai_config() is not None
