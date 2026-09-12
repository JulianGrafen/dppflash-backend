"""Resolve OpenAI vs Azure OpenAI for PDF structured extraction."""

from __future__ import annotations

import os
from dataclasses import dataclass
from urllib.parse import urlparse

from etl.services.dpp_extractor import ExtractorConfig
from etl.services.env_loader import _is_hosted_runtime, load_project_env, resolve_openai_api_key


@dataclass(frozen=True)
class AzureOpenAiConfig:
    endpoint: str
    api_key: str
    deployment: str
    api_version: str


def normalize_azure_endpoint(value: str) -> str:
    parsed = urlparse(value.strip())
    if not parsed.scheme or not parsed.netloc:
        raise ValueError(
            "AZURE_OPENAI_ENDPOINT must be a valid URL like https://<resource>.openai.azure.com"
        )
    return f"{parsed.scheme}://{parsed.netloc}"


def azure_openai_status() -> dict[str, bool]:
    endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT")
    api_key = os.environ.get("AZURE_OPENAI_API_KEY")
    deployment = os.environ.get("AZURE_OPENAI_DEPLOYMENT")
    return {
        "azure_endpoint_defined": endpoint is not None,
        "azure_api_key_defined": api_key is not None,
        "azure_deployment_defined": deployment is not None,
        "azure_endpoint_nonempty": bool(endpoint and str(endpoint).strip()),
        "azure_api_key_nonempty": bool(api_key and str(api_key).strip()),
        "azure_deployment_nonempty": bool(deployment and str(deployment).strip()),
    }


def resolve_azure_deployment_name() -> str | None:
    """
    Azure chat API expects the *deployment name* from AI Foundry, not the OpenAI model id.

    Optional override: DPP_EXTRACTOR_AZURE_DEPLOYMENT (never use DPP_EXTRACTOR_MODEL here).
    """
    override = os.environ.get("DPP_EXTRACTOR_AZURE_DEPLOYMENT", "").strip()
    if override:
        return override

    primary = os.environ.get("AZURE_OPENAI_DEPLOYMENT", "").strip()
    if primary:
        return primary

    return os.environ.get("AZURE_OPENAI_COMPLIANCE_DEPLOYMENT", "").strip() or None


def resolve_azure_openai_config() -> AzureOpenAiConfig | None:
    """Azure settings from process env (hosted) or dotenv files (local)."""
    if not _is_hosted_runtime():
        load_project_env()

    endpoint_raw = os.environ.get("AZURE_OPENAI_ENDPOINT", "").strip()
    api_key = os.environ.get("AZURE_OPENAI_API_KEY", "").strip()
    deployment = resolve_azure_deployment_name() or ""
    if not endpoint_raw or not api_key or not deployment:
        return None

    try:
        endpoint = normalize_azure_endpoint(endpoint_raw)
    except ValueError:
        return None

    api_version = os.environ.get("AZURE_OPENAI_API_VERSION", "2024-10-21").strip() or "2024-10-21"
    return AzureOpenAiConfig(
        endpoint=endpoint,
        api_key=api_key,
        deployment=deployment,
        api_version=api_version,
    )


def llm_extractor_configured() -> bool:
    return resolve_openai_api_key() is not None or resolve_azure_openai_config() is not None


def build_extractor_config(openai_api_key_override: str | None = None) -> ExtractorConfig | None:
    """
    Build extractor config: explicit OpenAI key override, then env OpenAI, then Azure OpenAI.
    """
    override = (openai_api_key_override or "").strip()
    if override:
        return _openai_config(override)

    direct_openai = resolve_openai_api_key()
    if direct_openai:
        return _openai_config(direct_openai)

    azure = resolve_azure_openai_config()
    if azure:
        return ExtractorConfig(
            model=azure.deployment,
            openai_api_key=None,
            azure_endpoint=azure.endpoint,
            azure_api_key=azure.api_key,
            azure_api_version=azure.api_version,
            timeout_seconds=float(os.environ.get("DPP_EXTRACTOR_TIMEOUT_SECONDS", "120")),
        )

    return None


def _openai_config(api_key: str) -> ExtractorConfig:
    return ExtractorConfig(
        openai_api_key=api_key,
        model=os.environ.get("DPP_EXTRACTOR_MODEL", "gpt-4o-2024-08-06"),
        timeout_seconds=float(os.environ.get("DPP_EXTRACTOR_TIMEOUT_SECONDS", "120")),
    )
