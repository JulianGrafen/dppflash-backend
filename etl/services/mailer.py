"""
SMTP mailer for supplier gap-request outreach (Stufe 2).
"""

from __future__ import annotations

import logging
import os
import smtplib
import uuid
from dataclasses import dataclass
from email.message import EmailMessage
from typing import Literal

from etl.graph.state import GapRecord

logger = logging.getLogger(__name__)

SendMode = Literal["smtp", "dry_run"]


@dataclass(frozen=True)
class EmailSendResult:
    success: bool
    recipient: str
    subject: str
    mode: SendMode
    message_id: str | None = None
    error: str | None = None
    magic_link: str | None = None


def _env_bool(key: str, default: bool = False) -> bool:
    raw = os.environ.get(key)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _smtp_settings() -> dict[str, str | int | bool] | None:
    host = os.environ.get("SMTP_HOST", "").strip()
    if not host:
        return None
    port_raw = os.environ.get("SMTP_PORT", "587").strip()
    try:
        port = int(port_raw)
    except ValueError:
        port = 587
    user = os.environ.get("SMTP_USER", "").strip()
    password = os.environ.get("SMTP_PASSWORD", "").strip()
    from_addr = (
        os.environ.get("SUPPLIER_OUTREACH_FROM", "").strip()
        or os.environ.get("SMTP_FROM", "").strip()
        or user
    )
    if not from_addr:
        return None
    use_ssl = _env_bool("SMTP_USE_SSL", default=port == 465)
    use_tls = _env_bool("SMTP_USE_TLS", default=not use_ssl)
    return {
        "host": host,
        "port": port,
        "user": user,
        "password": password,
        "from_addr": from_addr,
        "use_ssl": use_ssl,
        "use_tls": use_tls,
    }


def _send_via_smtp(msg: EmailMessage, smtp: dict[str, str | int | bool]) -> None:
    host = str(smtp["host"])
    port = int(smtp["port"])
    user = str(smtp["user"])
    password = str(smtp["password"])
    use_ssl = bool(smtp.get("use_ssl"))
    use_tls = bool(smtp.get("use_tls"))

    if use_ssl:
        with smtplib.SMTP_SSL(host, port, timeout=30) as server:
            server.ehlo()
            if user and password:
                server.login(user, password)
            server.send_message(msg)
        return

    with smtplib.SMTP(host, port, timeout=30) as server:
        server.ehlo()
        if use_tls:
            server.starttls()
            server.ehlo()
        if user and password:
            server.login(user, password)
        server.send_message(msg)


def build_supplier_gap_request_subject(product_identifier: str | None) -> str:
    product = product_identifier or "Produkt"
    return f"DPP / ESPR Datenanfrage — {product}"


def build_supplier_gap_request_body(
    *,
    product_identifier: str | None,
    supplier_name: str | None,
    gaps: list[GapRecord],
    magic_link: str | None = None,
) -> str:
    greeting = f"Sehr geehrte Damen und Herren{f' bei {supplier_name}' if supplier_name else ''},"
    product = product_identifier or "unser gemeinsames Produkt"
    lines = [
        greeting,
        "",
        f"wir erstellen derzeit den Digitalen Produktpass (DPP) gemäß EU ESPR für: {product}.",
        "Für die Compliance-Prüfung fehlen uns noch folgende Angaben:",
        "",
    ]

    if gaps:
        for gap in gaps:
            lines.append(f"- {gap.field_path}: {gap.reason}")
    else:
        lines.append("- Allgemeine ESPR-Produktdaten zur Vervollständigung des DPP")

    lines.extend(
        [
            "",
            "Bitte stellen Sie die fehlenden Informationen über unser Lieferantenportal bereit "
            "oder antworten Sie direkt auf diese E-Mail.",
        ]
    )

    if magic_link:
        lines.extend(["", f"Magic Link: {magic_link}"])

    lines.extend(
        [
            "",
            "Mit freundlichen Grüßen",
            "DPP-Flash Compliance Team",
        ]
    )
    return "\n".join(lines)


def build_supplier_gap_request_html(
    *,
    product_identifier: str | None,
    supplier_name: str | None,
    gaps: list[GapRecord],
    magic_link: str | None = None,
) -> str:
    greeting = f"Sehr geehrte Damen und Herren{f' bei {supplier_name}' if supplier_name else ''},"
    product = product_identifier or "unser gemeinsames Produkt"
    gap_items = "".join(
        f"<li><strong>{gap.field_path}</strong>: {gap.reason}</li>" for gap in gaps
    ) or "<li>Allgemeine ESPR-Produktdaten zur Vervollständigung des DPP</li>"

    button = ""
    if magic_link:
        button = f"""
        <p style="margin: 24px 0;">
          <a href="{magic_link}"
             style="background:#0c1929;color:#fff;padding:12px 20px;border-radius:8px;
                    text-decoration:none;font-weight:600;display:inline-block;">
            Daten jetzt einreichen
          </a>
        </p>
        <p style="font-size:12px;color:#64748b;">Magic Link: <a href="{magic_link}">{magic_link}</a></p>
        """

    return f"""<!DOCTYPE html>
<html lang="de">
  <body style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5;">
    <p>{greeting}</p>
    <p>wir erstellen derzeit den Digitalen Produktpass (DPP) gemäß EU ESPR für:
       <strong>{product}</strong>.</p>
    <p>Für die Compliance-Prüfung fehlen uns noch folgende Angaben:</p>
    <ul>{gap_items}</ul>
    <p>Bitte stellen Sie die fehlenden Informationen über unser Lieferantenportal bereit
       oder antworten Sie direkt auf diese E-Mail.</p>
    {button}
    <p>Mit freundlichen Grüßen<br/>DPP-Flash Compliance Team</p>
  </body>
</html>"""


def send_supplier_gap_request_email(
    *,
    to_address: str,
    product_identifier: str | None,
    supplier_name: str | None,
    gaps: list[GapRecord],
    magic_link: str | None = None,
) -> EmailSendResult:
    """
    Send a gap-request e-mail to the supplier contact.

    Requires ``SUPPLIER_OUTREACH_ENABLED=true`` and SMTP env vars for live send.
    Otherwise runs in dry-run mode (logged, ``success=True``).
    """
    recipient = to_address.strip().lower()
    subject = build_supplier_gap_request_subject(product_identifier)
    body = build_supplier_gap_request_body(
        product_identifier=product_identifier,
        supplier_name=supplier_name,
        gaps=gaps,
        magic_link=magic_link,
    )
    html = build_supplier_gap_request_html(
        product_identifier=product_identifier,
        supplier_name=supplier_name,
        gaps=gaps,
        magic_link=magic_link,
    )
    message_id = f"dpp-outreach-{uuid.uuid4().hex[:12]}"

    outreach_enabled = _env_bool("SUPPLIER_OUTREACH_ENABLED", default=False)
    smtp = _smtp_settings()

    if not outreach_enabled or smtp is None:
        logger.info(
            "DRY RUN supplier outreach → %s subject=%s gaps=%s link=%s",
            recipient,
            subject,
            len(gaps),
            magic_link,
        )
        return EmailSendResult(
            success=True,
            recipient=recipient,
            subject=subject,
            mode="dry_run",
            message_id=message_id,
            magic_link=magic_link,
        )

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = str(smtp["from_addr"])
    msg["To"] = recipient
    msg["Message-ID"] = f"<{message_id}@dpp-flash>"
    msg.set_content(body)
    msg.add_alternative(html, subtype="html")

    try:
        _send_via_smtp(msg, smtp)
        logger.info("Supplier outreach e-mail sent to %s (id=%s)", recipient, message_id)
        return EmailSendResult(
            success=True,
            recipient=recipient,
            subject=subject,
            mode="smtp",
            message_id=message_id,
            magic_link=magic_link,
        )
    except Exception as exc:  # noqa: BLE001 — return structured failure to pipeline
        logger.exception("Supplier outreach e-mail failed for %s", recipient)
        return EmailSendResult(
            success=False,
            recipient=recipient,
            subject=subject,
            mode="smtp",
            message_id=message_id,
            error=str(exc),
            magic_link=magic_link,
        )
