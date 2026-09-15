"""LangSmith tracing helpers (EU endpoint via LANGSMITH_ENDPOINT)."""

from __future__ import annotations

import os
from typing import Any

from langsmith import traceable

__all__ = ["traceable", "langsmith_config_status"]


def _env_truthy(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in ("true", "1", "yes")


def langsmith_config_status() -> dict[str, Any]:
    """Non-secret diagnostics for /diagnostics and support."""
    api_key_set = bool(os.environ.get("LANGSMITH_API_KEY", "").strip())
    tracing_flag = _env_truthy("LANGSMITH_TRACING") or _env_truthy("LANGCHAIN_TRACING_V2")
    endpoint = os.environ.get("LANGSMITH_ENDPOINT", "").strip() or None
    project = (
        os.environ.get("LANGSMITH_PROJECT", "").strip()
        or os.environ.get("LANGCHAIN_PROJECT", "").strip()
        or None
    )
    return {
        "langsmith_tracing_active": tracing_flag and api_key_set,
        "langsmith_tracing_flag": tracing_flag,
        "langsmith_api_key_configured": api_key_set,
        "langsmith_endpoint": endpoint,
        "langsmith_project": project,
    }
