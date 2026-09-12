"""
Load project environment variables for the Python ETL / LangGraph runtime.

Next.js uses `.env.local`; LangGraph Studio defaults to `.env` in langgraph.json.
This loader mirrors Next.js precedence so one file works for both stacks.
"""

from __future__ import annotations

import os
from pathlib import Path

_PROJECT_ROOT = Path(__file__).resolve().parents[2]


def load_project_env() -> Path | None:
    """
    Load `.env` then `.env.local` (local overrides base — same as Next.js).

    Returns the last env file that was found, or None.
    """
    try:
        from dotenv import load_dotenv
    except ImportError:
        return _load_env_manual()

    last_loaded: Path | None = None
    for filename in (".env", ".env.local"):
        path = _PROJECT_ROOT / filename
        if path.is_file():
            load_dotenv(path, override=filename == ".env.local")
            last_loaded = path

    return last_loaded


def _load_env_manual() -> Path | None:
    """Minimal fallback when python-dotenv is not installed."""
    last_loaded: Path | None = None
    for filename in (".env", ".env.local"):
        path = _PROJECT_ROOT / filename
        if not path.is_file():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue
            key, _, value = stripped.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if filename == ".env.local" or key not in os.environ:
                os.environ[key] = value
        last_loaded = path
    return last_loaded


def _read_env_key_from_files(key: str) -> tuple[str | None, str | None]:
    """Return (value, hint) where hint explains misconfiguration in env files."""
    for filename in (".env.local", ".env"):
        path = _PROJECT_ROOT / filename
        if not path.is_file():
            continue
        for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            if not stripped.startswith(f"{key}="):
                continue
            value = stripped.partition("=")[2].strip().strip('"').strip("'")
            if value:
                return value, None
            return None, f"`{key}` is present but empty in `{filename}` (line {line_no})."
    return None, None


def openai_api_key_status() -> dict[str, bool]:
    """Non-secret diagnostics for /diagnostics and support."""
    raw = os.environ.get("OPENAI_API_KEY")
    stripped = raw.strip() if isinstance(raw, str) else ""
    return {
        "openai_env_var_defined": raw is not None,
        "openai_env_var_nonempty": bool(stripped),
    }


def resolve_openai_api_key() -> str | None:
    """Return trimmed OpenAI API key if configured (process env wins over dotenv files)."""
    value = os.environ.get("OPENAI_API_KEY", "").strip()
    if value:
        return value

    if _is_hosted_runtime():
        return None

    load_project_env()
    value = os.environ.get("OPENAI_API_KEY", "").strip()
    if value:
        return value
    file_value, _hint = _read_env_key_from_files("OPENAI_API_KEY")
    return file_value or None


def _is_hosted_runtime() -> bool:
    return bool(
        os.environ.get("RENDER", "").strip()
        or os.environ.get("RENDER_SERVICE_ID", "").strip()
        or os.environ.get("VERCEL", "").strip()
    )


def describe_missing_llm_config() -> str:
    from etl.services.llm_config import llm_extractor_configured, resolve_azure_openai_config

    load_project_env()
    if llm_extractor_configured():
        loaded = load_project_env()
        return f"Loaded env from `{loaded.name}`." if loaded else "LLM credentials are set in the environment."

    if _is_hosted_runtime():
        status = openai_api_key_status()
        service = os.environ.get("RENDER_SERVICE_NAME", "dppflash-etl")
        if status["openai_env_var_defined"] and not status["openai_env_var_nonempty"]:
            return (
                f"OPENAI_API_KEY is set on Render service `{service}` but empty. "
                "Re-enter the key in Render → Environment (no quotes/spaces only), then redeploy."
            )
        azure = resolve_azure_openai_config()
        if azure is None:
            partial = []
            if os.environ.get("AZURE_OPENAI_ENDPOINT", "").strip():
                partial.append("endpoint")
            if os.environ.get("AZURE_OPENAI_API_KEY", "").strip():
                partial.append("api key")
            if partial and not os.environ.get("AZURE_OPENAI_DEPLOYMENT", "").strip():
                return (
                    f"Azure OpenAI is partially configured on `{service}` ({', '.join(partial)} set) "
                    "but AZURE_OPENAI_DEPLOYMENT is missing. "
                    "Add the deployment name from Azure AI Foundry, then redeploy dppflash-etl."
                )
        return (
            f"No LLM credentials on Render service `{service}`. "
            "Option A (Azure): AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT "
            "(same as the Next.js app). "
            "Option B (OpenAI): OPENAI_API_KEY on dppflash-etl, or on Vercel with ETL_SERVICE_SECRET "
            "(forwarded on PDF upload). "
            "Check: https://dppflash-etl.onrender.com/diagnostics"
        )

    loaded = load_project_env()
    env_hint = f"Loaded env from `{loaded.name}`." if loaded else "No `.env` or `.env.local` found in project root."

    _, empty_hint = _read_env_key_from_files("OPENAI_API_KEY")
    if empty_hint:
        return (
            f"{env_hint} {empty_hint} "
            "Paste your key: OPENAI_API_KEY=sk-... then restart the ETL server or `langgraph dev`."
        )

    return (
        f"{env_hint} Add `OPENAI_API_KEY=sk-...` to `.env.local` or `.env`, "
        "then restart the ETL server (`uvicorn etl.http_service:app`) or `langgraph dev`."
    )
