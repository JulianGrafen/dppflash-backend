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


def resolve_openai_api_key() -> str | None:
    """Return trimmed OpenAI API key if configured."""
    value = os.environ.get("OPENAI_API_KEY", "").strip()
    return value or None


def describe_missing_llm_config() -> str:
    loaded = load_project_env()
    env_hint = f"Loaded env from `{loaded.name}`." if loaded else "No `.env` or `.env.local` found in project root."

    if resolve_openai_api_key():
        return env_hint

    return (
        f"{env_hint} LLM extraction requires `OPENAI_API_KEY=sk-...` "
        "as an active (uncommented) line in `.env.local` or `.env`. "
        "Then restart `langgraph dev`."
    )
