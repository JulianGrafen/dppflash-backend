"""Auth helpers for trusted Next.js → ETL calls."""

from __future__ import annotations

import os

from etl.services.env_loader import resolve_openai_api_key


def etl_bearer_authorized(authorization: str | None) -> bool:
    secret = os.environ.get("ETL_SERVICE_SECRET", "").strip()
    if not secret:
        return True
    return authorization == f"Bearer {secret}"


def resolve_openai_for_inbound_request(
    authorization: str | None,
    forwarded_api_key: str | None,
) -> str | None:
    """
    Prefer OPENAI_API_KEY on the ETL process; else accept X-DPP-OpenAI-Api-Key from
    Vercel when the request bears ETL_SERVICE_SECRET (or no secret in local dev).
    """
    direct = resolve_openai_api_key()
    if direct:
        return direct

    forwarded = (forwarded_api_key or "").strip()
    if not forwarded:
        return None

    if not etl_bearer_authorized(authorization):
        return None

    return forwarded
