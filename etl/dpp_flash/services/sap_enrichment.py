"""
Supplier e-mail cascade — orchestrates SRM → PO history → vendor master lookups.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Callable, Final

from etl.dpp_flash.services.sap_mock import (
    SapApiError,
    fetch_sap_po_contact,
    fetch_sap_vendor_master,
    fetch_srm_compliance_contact,
)
from etl.models.audit_field import AuditField, SourceSystem

logger = logging.getLogger(__name__)

EMAIL_SOURCE_SRM: Final[str] = SourceSystem.SAP_SRM.value
EMAIL_SOURCE_PO: Final[str] = SourceSystem.SAP_PO_HISTORY.value
EMAIL_SOURCE_VENDOR: Final[str] = SourceSystem.SAP_VENDOR_MASTER.value


@dataclass(frozen=True)
class SupplierEmailLookup:
    """Successful supplier e-mail resolution with full audit trail."""

    email: AuditField


LookupStep = Callable[[], AuditField | None]


def _safe_lookup(step_name: str, lookup: LookupStep) -> AuditField | None:
    try:
        return lookup()
    except SapApiError as exc:
        logger.warning("%s failed (%s) — falling back to next step", step_name, exc)
        return None
    except Exception:  # noqa: BLE001
        logger.exception("%s raised an unexpected error — falling back", step_name)
        return None


def resolve_supplier_email(product_id: str, supplier_id: str) -> SupplierEmailLookup | None:
    steps: tuple[tuple[str, str, LookupStep], ...] = (
        (
            EMAIL_SOURCE_SRM,
            "SRM compliance contact",
            lambda: fetch_srm_compliance_contact(supplier_id),
        ),
        (
            EMAIL_SOURCE_PO,
            "SAP PO contact",
            lambda: fetch_sap_po_contact(product_id, supplier_id),
        ),
        (
            EMAIL_SOURCE_VENDOR,
            "SAP vendor master",
            lambda: fetch_sap_vendor_master(supplier_id),
        ),
    )

    for source, step_name, lookup in steps:
        audited_email = _safe_lookup(step_name, lookup)
        if audited_email is not None and audited_email.value:
            logger.info(
                "resolve_supplier_email: hit source=%s supplier_id=%s",
                source,
                supplier_id,
            )
            return SupplierEmailLookup(email=audited_email)

    logger.warning(
        "resolve_supplier_email: no e-mail for product_id=%s supplier_id=%s",
        product_id,
        supplier_id,
    )
    return None
