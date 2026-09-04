"""
Mock SAP / SRM API clients for supplier e-mail resolution.

Replace these functions with real ``httpx`` calls against Ariba, EKKO, LFA1/ADR6
without changing ``resolve_supplier_email`` or ``sap_enrichment_node``.
"""

from __future__ import annotations

import logging
import time
from typing import Final

from etl.models.audit_field import AuditField, SourceSystem

logger = logging.getLogger(__name__)

_MOCK_LATENCY_MS: Final[int] = 0

_SRM_SOURCE_DETAIL: Final[str] = "SAP_SRM_ARIBA / BP_COMPLIANCE_CONTACT-SMTP"
_PO_SOURCE_DETAIL: Final[str] = "SAP_EKKO_PO_HISTORY_2026 / EKPO-LIFNR → ADR6-SMTP_ADDR"
_VENDOR_SOURCE_DETAIL: Final[str] = "Tabelle LFA1, Feld ADR6-SMTP_ADDR"


class SapApiError(Exception):
    """Raised when a simulated SAP endpoint returns a transient or hard failure."""

    def __init__(self, service: str, status_code: int, message: str) -> None:
        self.service = service
        self.status_code = status_code
        super().__init__(f"[{service}] HTTP {status_code}: {message}")


_SRM_COMPLIANCE_CONTACTS: Final[dict[str, str]] = {
    "SRM-HIT-001": "compliance.dpp@srm-supplier.example",
}

_SAP_PO_CONTACTS: Final[dict[str, str]] = {
    "PO-HIT-002": "vertrieb.po@supplier.example",
}

_SAP_VENDOR_MASTER: Final[dict[str, str]] = {
    "VENDOR-HIT-003": "info@vendor-master.example",
    "muster-gmbh": "info@muster-gmbh.example",
    "muster-klebstoff-gmbh": "kontakt@muster-klebstoff.de",
}

_SRM_ERROR_IDS: Final[frozenset[str]] = frozenset({"SRM-ERROR-500"})
_PO_ERROR_IDS: Final[frozenset[str]] = frozenset({"PO-ERROR-500"})
_VENDOR_ERROR_IDS: Final[frozenset[str]] = frozenset({"VENDOR-ERROR-500"})


def _simulate_network_delay() -> None:
    if _MOCK_LATENCY_MS > 0:
        time.sleep(_MOCK_LATENCY_MS / 1000.0)


def fetch_srm_compliance_contact(supplier_id: str) -> AuditField | None:
    """Simulate SAP Ariba SRM compliance contact lookup."""
    _simulate_network_delay()
    normalized = supplier_id.strip()

    if normalized in _SRM_ERROR_IDS:
        logger.warning("fetch_srm_compliance_contact: simulated 500 for %s", normalized)
        raise SapApiError("SRM_ARIBA", 500, "Ariba compliance contact service unavailable")

    email = _SRM_COMPLIANCE_CONTACTS.get(normalized)
    logger.info(
        "fetch_srm_compliance_contact: supplier_id=%s hit=%s",
        normalized,
        email is not None,
    )
    if email is None:
        return None
    return AuditField.from_sap(
        email,
        _SRM_SOURCE_DETAIL,
        source_system=SourceSystem.SAP_SRM,
    )


def fetch_sap_po_contact(product_id: str, supplier_id: str) -> AuditField | None:
    """Simulate SAP MM purchase-order history contact lookup."""
    _simulate_network_delay()
    normalized_supplier = supplier_id.strip()
    normalized_product = product_id.strip()

    if normalized_supplier in _PO_ERROR_IDS:
        logger.warning("fetch_sap_po_contact: simulated 500 for %s", normalized_supplier)
        raise SapApiError("SAP_PO_HISTORY", 500, "EKKO contact lookup timed out")

    if not normalized_product or normalized_product.lower() == "unknown":
        logger.info("fetch_sap_po_contact: missing product_id — skip PO lookup")
        return None

    email = _SAP_PO_CONTACTS.get(normalized_supplier)
    logger.info(
        "fetch_sap_po_contact: product_id=%s supplier_id=%s hit=%s",
        normalized_product,
        normalized_supplier,
        email is not None,
    )
    if email is None:
        return None
    return AuditField.from_sap(
        email,
        _PO_SOURCE_DETAIL,
        source_system=SourceSystem.SAP_PO_HISTORY,
    )


def fetch_sap_vendor_master(supplier_id: str) -> AuditField | None:
    """Simulate SAP vendor master (LFA1/ADR6) generic inbox lookup."""
    _simulate_network_delay()
    normalized = supplier_id.strip()

    if normalized in _VENDOR_ERROR_IDS:
        logger.warning("fetch_sap_vendor_master: simulated 500 for %s", normalized)
        raise SapApiError("SAP_VENDOR_MASTER", 500, "LFA1/ADR6 read failed")

    email = _SAP_VENDOR_MASTER.get(normalized)
    logger.info(
        "fetch_sap_vendor_master: supplier_id=%s hit=%s",
        normalized,
        email is not None,
    )
    if email is None:
        return None
    return AuditField.from_sap(
        email,
        _VENDOR_SOURCE_DETAIL,
        source_system=SourceSystem.SAP_VENDOR_MASTER,
    )
