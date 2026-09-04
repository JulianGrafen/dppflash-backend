"""SAP / SRM integration services for DPP-Flash (mock → production swap)."""

from etl.dpp_flash.services.sap_enrichment import resolve_supplier_email
from etl.dpp_flash.services.sap_mock import (
    SapApiError,
    fetch_sap_po_contact,
    fetch_sap_vendor_master,
    fetch_srm_compliance_contact,
)

__all__ = [
    "SapApiError",
    "fetch_sap_po_contact",
    "fetch_sap_vendor_master",
    "fetch_srm_compliance_contact",
    "resolve_supplier_email",
]
