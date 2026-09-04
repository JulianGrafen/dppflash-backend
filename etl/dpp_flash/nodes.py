"""
DPP-Flash LangGraph nodes — dummy agent implementations for the scaffold.

Each node is synchronous, logs its action, and returns a partial state update.
Production implementations will replace the simulated I/O with LLM / SAP / mail APIs.
"""

from __future__ import annotations

import logging
import re
from typing import Any

from etl.dpp_flash.services.sap_enrichment import resolve_supplier_email
from etl.dpp_flash.state import (
    ESCALATION_RETRY_LIMIT,
    STATUS_EMAIL_FOUND,
    STATUS_REQUIRES_HUMAN_INTERVENTION,
    DPPState,
    MANDATORY_FIELDS,
)

logger = logging.getLogger(__name__)

_COMPOSITION_PATTERN = re.compile(
    r"(?P<label>[^;\n%]+?)\s*(?:[:=]?\s*)?(?P<value>\d{1,3}(?:[.,]\d+)?)\s*%",
    re.IGNORECASE,
)
_MASS_BALANCE_TOLERANCE = 0.5


def _append_error(state: DPPState, message: str) -> list[str]:
    existing = list(state.get("errors") or [])
    if message not in existing:
        existing.append(message)
    return existing


def _parse_composition_percentages(text: str) -> list[float]:
    values: list[float] = []
    for match in _COMPOSITION_PATTERN.finditer(text):
        raw = match.group("value").replace(",", ".")
        try:
            values.append(float(raw))
        except ValueError:
            continue
    return values


def _mass_balance_gap(composition: str | None) -> str | None:
    if not composition:
        return "material_composition (missing — mass balance cannot be verified)"
    percentages = _parse_composition_percentages(composition)
    if not percentages:
        return None
    total = round(sum(percentages), 2)
    if abs(total - 100.0) > _MASS_BALANCE_TOLERANCE:
        return f"material_composition (mass balance {total}% ≠ 100%)"
    return None


def extractor_node(state: DPPState) -> dict[str, Any]:
    """
    Simulate document extraction (LLM / OCR placeholder).

    Parses lightweight patterns from ``raw_document`` and fills ``extracted_data``.
    """
    try:
        raw = (state.get("raw_document") or "").strip()
        product_id = state.get("product_id") or "unknown"

        if not raw:
            logger.warning("extractor_node: empty raw_document for product_id=%s", product_id)
            return {
                "extracted_data": {},
                "status": "extraction_failed",
                "errors": _append_error(state, "extractor_node: raw_document is empty."),
            }

        extracted: dict[str, Any] = {
            "product_id": product_id,
            "product_name": _extract_line_value(raw, ("produktname", "product name", "product:")),
            "manufacturer": _extract_line_value(raw, ("hersteller", "manufacturer")),
            "supplier_id": _extract_line_value(
                raw,
                ("supplier_id", "supplier-id", "lieferant-id", "vendor id", "lifnr"),
            ),
            "material_composition": _extract_section(raw, ("abschnitt 3", "section 3", "zusammensetzung")),
            "co2_kg": _extract_line_value(raw, ("co2", "co₂", "carbon footprint")),
            "source": "simulated_extractor_v1",
        }

        logger.info(
            "extractor_node: extracted %d fields for product_id=%s",
            sum(1 for value in extracted.values() if value),
            product_id,
        )
        print(f"[extractor_node] product_id={product_id} fields={list(extracted.keys())}")

        return {
            "extracted_data": extracted,
            "status": "extracted",
            "errors": [],
        }
    except Exception as exc:  # noqa: BLE001 — node-level guard; never crash the graph
        logger.exception("extractor_node failed")
        return {
            "extracted_data": {},
            "status": "extraction_failed",
            "errors": _append_error(state, f"extractor_node: {exc}"),
        }


def validator_node(state: DPPState) -> dict[str, Any]:
    """
    Validate mandatory ESPR fields and material mass balance.

    Sets ``is_valid`` and populates ``gaps`` for downstream enrichment.
    """
    try:
        extracted = dict(state.get("extracted_data") or {})
        gaps: list[str] = []

        for field in MANDATORY_FIELDS:
            value = extracted.get(field)
            if value is None or (isinstance(value, str) and not value.strip()):
                gaps.append(field)

        composition = extracted.get("material_composition")
        if isinstance(composition, str):
            balance_gap = _mass_balance_gap(composition)
            if balance_gap and balance_gap not in gaps:
                gaps.append(balance_gap)

        is_valid = len(gaps) == 0
        status = "validated" if is_valid else "validation_failed"

        logger.info(
            "validator_node: product_id=%s is_valid=%s gaps=%s",
            state.get("product_id"),
            is_valid,
            gaps,
        )
        print(f"[validator_node] is_valid={is_valid} gaps={gaps}")

        return {
            "is_valid": is_valid,
            "gaps": gaps,
            "status": status,
        }
    except Exception as exc:  # noqa: BLE001
        logger.exception("validator_node failed")
        return {
            "is_valid": False,
            "gaps": list(state.get("gaps") or []),
            "status": "validation_error",
            "errors": _append_error(state, f"validator_node: {exc}"),
        }


def sap_enrichment_node(state: DPPState) -> dict[str, Any]:
    """
    Resolve supplier e-mail via SAP cascade: SRM → PO history → vendor master.

    On success sets ``status=EMAIL_FOUND``; on total failure sets
    ``status=REQUIRES_HUMAN_INTERVENTION`` for graph pause / HITL routing.
    """
    product_id = state.get("product_id", "unknown")

    try:
        supplier_id = _resolve_supplier_id(state)
        lookup = resolve_supplier_email(product_id=product_id, supplier_id=supplier_id)

        if lookup is not None:
            logger.info(
                "sap_enrichment_node: product_id=%s supplier_id=%s source=%s",
                product_id,
                supplier_id,
                lookup.email.source_system,
            )
            print(
                f"[sap_enrichment_node] EMAIL_FOUND source={lookup.email.source_system} "
                f"email={lookup.email.value} supplier_id={supplier_id}"
            )
            return {
                "supplier_email": lookup.email.value,
                "email_source": lookup.email.source_system,
                "email_found": True,
                "status": STATUS_EMAIL_FOUND,
            }

        logger.warning(
            "sap_enrichment_node: no e-mail — HITL required product_id=%s supplier_id=%s",
            product_id,
            supplier_id,
        )
        print(
            f"[sap_enrichment_node] REQUIRES_HUMAN_INTERVENTION "
            f"product_id={product_id} supplier_id={supplier_id}"
        )
        return {
            "supplier_email": None,
            "email_source": None,
            "email_found": False,
            "status": STATUS_REQUIRES_HUMAN_INTERVENTION,
            "errors": _append_error(
                state,
                "sap_enrichment_node: all SAP lookup steps failed — buyer intervention required.",
            ),
        }
    except Exception as exc:  # noqa: BLE001 — node must never crash the graph
        logger.exception("sap_enrichment_node failed")
        return {
            "supplier_email": None,
            "email_source": None,
            "email_found": False,
            "status": STATUS_REQUIRES_HUMAN_INTERVENTION,
            "errors": _append_error(state, f"sap_enrichment_node: {exc}"),
        }


def supplier_outreach_node(state: DPPState) -> dict[str, Any]:
    """
    Simulate async supplier e-mail requesting missing ESPR fields.

    Increments ``retry_count`` on each invocation (sync stand-in for outreach rounds).
    """
    try:
        retry_count = int(state.get("retry_count") or 0) + 1
        supplier_email = state.get("supplier_email") or "unknown@supplier.example"
        gaps = state.get("gaps") or []

        logger.info(
            "supplier_outreach_node: attempt=%s email=%s gaps=%s",
            retry_count,
            supplier_email,
            gaps,
        )
        print(
            f"[supplier_outreach_node] attempt={retry_count} "
            f"to={supplier_email} requesting gaps={gaps}"
        )

        return {
            "retry_count": retry_count,
            "status": "awaiting_supplier_response",
        }
    except Exception as exc:  # noqa: BLE001
        logger.exception("supplier_outreach_node failed")
        return {
            "retry_count": int(state.get("retry_count") or 0),
            "status": "supplier_outreach_error",
            "errors": _append_error(state, f"supplier_outreach_node: {exc}"),
        }


def human_escalation_node(state: DPPState) -> dict[str, Any]:
    """
    Human-in-the-loop escalation — buyer must close remaining gaps manually.

    Triggered when SAP has no e-mail or supplier retries are exhausted.
    """
    try:
        product_id = state.get("product_id", "unknown")
        reason = (
            "retry_limit_exceeded"
            if int(state.get("retry_count") or 0) >= ESCALATION_RETRY_LIMIT
            else "supplier_email_not_found"
        )

        logger.warning(
            "human_escalation_node: product_id=%s reason=%s gaps=%s",
            product_id,
            reason,
            state.get("gaps"),
        )
        print(
            f"[human_escalation_node] INTERRUPT product_id={product_id} "
            f"reason={reason} → assign to buyer"
        )

        return {
            "status": "pending_human_review",
            "errors": _append_error(state, f"human_escalation_node: {reason}"),
        }
    except Exception as exc:  # noqa: BLE001
        logger.exception("human_escalation_node failed")
        return {
            "status": "escalation_error",
            "errors": _append_error(state, f"human_escalation_node: {exc}"),
        }


# ── Helpers ────────────────────────────────────────────────────────────────────


def _resolve_supplier_id(state: DPPState) -> str:
    """Derive SAP vendor key from extracted data or manufacturer slug."""
    extracted = state.get("extracted_data") or {}
    for key in ("supplier_id", "vendor_id", "lifnr"):
        value = extracted.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()

    manufacturer = extracted.get("manufacturer")
    if isinstance(manufacturer, str) and manufacturer.strip():
        slug = re.sub(r"[^a-z0-9]+", "-", manufacturer.lower()).strip("-")
        if slug:
            return slug

    return f"UNKNOWN-{state.get('product_id', 'product')}"


def _extract_line_value(text: str, labels: tuple[str, ...]) -> str | None:
    lower = text.lower()
    for label in labels:
        pattern = re.compile(rf"{re.escape(label)}\s*:?\s*(.+)", re.IGNORECASE)
        match = pattern.search(lower)
        if match:
            # Return slice from original text to preserve casing
            start = match.start(1)
            line_end = text.find("\n", start)
            snippet = text[start:line_end if line_end != -1 else None].strip()
            return snippet or None
    return None


def _extract_section(text: str, headers: tuple[str, ...]) -> str | None:
    lower = text.lower()
    for header in headers:
        idx = lower.find(header)
        if idx == -1:
            continue
        rest = text[idx:]
        lines = rest.splitlines()
        first_line = lines[0]
        same_line = ""
        if ":" in first_line:
            same_line = first_line.split(":", 1)[1].strip()
        following = "\n".join(line.strip() for line in lines[1:4] if line.strip())
        combined = "\n".join(part for part in (same_line, following) if part)
        return combined or None
    return None
