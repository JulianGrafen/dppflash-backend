"""
Resolve supplier outreach recipient strictly from the current sap_export JSON.
"""

from __future__ import annotations

from typing import Any

from etl.models.audit_field import AuditField
from etl.services.sap_product_odata_ingest import (
    BomSupplierContactBlock,
    coerce_sap_product_payload,
    select_best_bom_supplier_contact,
)


def resolve_bom_contact_from_sap_export(
    sap_export: dict[str, Any] | None,
) -> tuple[BomSupplierContactBlock | None, AuditField | None]:
    """
    Parse ``sap_export`` fresh and return the best BOM supplier contact.

    Never reads cached state — call this at send time with the current JSON blob.
    """
    product = coerce_sap_product_payload(sap_export)
    if product is None:
        return None, None
    return select_best_bom_supplier_contact(product)


def resolve_outreach_recipient_from_json(
    sap_export: dict[str, Any] | None,
) -> AuditField | None:
    """Return outreach recipient from the current JSON only."""
    _, contact = resolve_bom_contact_from_sap_export(sap_export)
    return contact


def resolve_outreach_supplier_name_from_json(
    sap_export: dict[str, Any] | None,
) -> str | None:
    block, _ = resolve_bom_contact_from_sap_export(sap_export)
    if block is None or not block.supplier_name:
        return None
    return block.supplier_name
