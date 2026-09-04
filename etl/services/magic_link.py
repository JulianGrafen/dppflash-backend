"""
HMAC-signed magic links for supplier ESPR gap outreach.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
from datetime import datetime, timedelta, timezone
from typing import Any

from etl.graph.state import GapRecord

DEFAULT_TTL_DAYS = 14


class MagicLinkError(ValueError):
    """Invalid or expired supplier outreach token."""


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def outreach_secret() -> str:
    secret = os.environ.get("SUPPLIER_OUTREACH_SECRET", "").strip()
    if not secret:
        raise MagicLinkError(
            "SUPPLIER_OUTREACH_SECRET is not configured — cannot create magic links."
        )
    return secret


def gaps_to_payload(gaps: list[GapRecord]) -> list[dict[str, str]]:
    return [
        {
            "field_path": gap.field_path,
            "reason": gap.reason,
            "severity": gap.severity,
        }
        for gap in gaps
    ]


def build_outreach_payload(
    *,
    product_identifier: str | None,
    recipient_email: str,
    supplier_name: str | None,
    gaps: list[GapRecord],
    ttl_days: int = DEFAULT_TTL_DAYS,
) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    return {
        "product_identifier": product_identifier,
        "recipient_email": recipient_email.strip().lower(),
        "supplier_name": supplier_name,
        "gaps": gaps_to_payload(gaps),
        "issued_at": now.isoformat(),
        "expires_at": (now + timedelta(days=ttl_days)).isoformat(),
    }


def sign_outreach_payload(payload: dict[str, Any]) -> str:
    body = _b64url_encode(
        json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    )
    signature = hmac.new(
        outreach_secret().encode("utf-8"),
        body.encode("ascii"),
        hashlib.sha256,
    ).hexdigest()
    return f"{body}.{signature}"


def verify_outreach_token(token: str) -> dict[str, Any]:
    if not token or "." not in token:
        raise MagicLinkError("Malformed outreach token.")

    body, signature = token.rsplit(".", 1)
    expected = hmac.new(
        outreach_secret().encode("utf-8"),
        body.encode("ascii"),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise MagicLinkError("Invalid outreach token signature.")

    try:
        payload = json.loads(_b64url_decode(body).decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError, ValueError) as exc:
        raise MagicLinkError("Invalid outreach token payload.") from exc

    expires_at = payload.get("expires_at")
    if not isinstance(expires_at, str):
        raise MagicLinkError("Outreach token missing expiry.")
    try:
        expiry = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
    except ValueError as exc:
        raise MagicLinkError("Outreach token expiry is invalid.") from exc
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > expiry:
        raise MagicLinkError("Outreach token expired.")

    return payload


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def resolve_app_base_url() -> str:
    for key in (
        "NEXT_PUBLIC_DPP_URL",
        "NEXT_PUBLIC_APP_URL",
        "RENDER_EXTERNAL_URL",
        "VERCEL_URL",
    ):
        value = os.environ.get(key, "").strip()
        if not value:
            continue
        if not value.startswith("http"):
            return f"https://{value.rstrip('/')}"
        return value.rstrip("/")
    return "http://localhost:3000"


def build_supplier_magic_link(
    *,
    product_identifier: str | None,
    recipient_email: str,
    supplier_name: str | None,
    gaps: list[GapRecord],
) -> tuple[str, str]:
    """
    Create signed token and full magic link URL.

    Returns ``(token, url)``.
    """
    payload = build_outreach_payload(
        product_identifier=product_identifier,
        recipient_email=recipient_email,
        supplier_name=supplier_name,
        gaps=gaps,
    )
    signed = sign_outreach_payload(payload)
    url = f"{resolve_app_base_url()}/supplier/outreach/{signed}"
    return signed, url
