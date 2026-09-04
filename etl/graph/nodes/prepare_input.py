"""Normalize LangGraph Studio / API inputs before extraction."""

from __future__ import annotations

from typing import Any

from etl.graph.coerce_state import coerce_raw_document, coerce_sku_master_data
from etl.graph.state import (
    clamp_max_extraction_attempts,
    DppGraphState,
    RawDocumentInput,
)
from etl.services.sap_legacy_ingest import (
    coerce_sap_legacy_payload,
    is_sap_legacy_export,
    sap_legacy_to_raw_document,
    sap_legacy_to_sku_master_data,
    sap_legacy_to_supplier_odata,
)
from etl.services.sap_product_odata_ingest import (
    coerce_sap_product_payload,
    sap_product_to_raw_document,
    sap_product_to_sku_master_data,
    select_best_bom_supplier_contact,
)


def _existing_document_text(raw_document: RawDocumentInput | None) -> str | None:
    if raw_document is None:
        return None
    text = (raw_document.document_text or "").strip()
    return text or None


def _resolve_sap_export_payload(state: DppGraphState) -> tuple[dict[str, Any] | None, str | None]:
    """Return (payload, format) where format is ``legacy`` or ``product_odata``."""
    product_payload = coerce_sap_product_payload(state.get("sap_export"))
    if product_payload is not None:
        return product_payload, "product_odata"

    legacy_payload = coerce_sap_legacy_payload(state.get("sap_export"))
    if legacy_payload is not None:
        return legacy_payload, "legacy"

    if isinstance(state, dict):
        candidate = {key: value for key, value in state.items() if not key.startswith("_")}
        product_payload = coerce_sap_product_payload(candidate)
        if product_payload is not None:
            return product_payload, "product_odata"
        if is_sap_legacy_export(candidate):
            return candidate, "legacy"

    return None, None


async def prepare_input_node(state: DppGraphState) -> dict[str, Any]:
    """
    Accept standard ``raw_document`` input or SAP export blobs.

    Studio users can pass either:
    - ``{"raw_document": {"document_text": "..."}}``
    - ``{"sap_export": { ... MATERIAL_BASE, BOM_components_dirty, ... }}`` (legacy)
    - ``{"sap_export": { "d": { "Product": ..., "to_BillOfMaterial": ... } } }`` (S/4 OData)
    - the SAP JSON fields directly at the top level of the input object
    """
    raw_document = coerce_raw_document(state.get("raw_document"))
    sku_master_data = coerce_sku_master_data(state.get("sku_master_data"))
    metadata = dict(state.get("metadata") or {})

    sap_payload, sap_format = _resolve_sap_export_payload(state)

    if sap_payload is None and raw_document is not None:
        sap_payload = coerce_sap_product_payload(raw_document.document_text)
        sap_format = "product_odata" if sap_payload is not None else None
        if sap_payload is None:
            sap_payload = coerce_sap_legacy_payload(raw_document.document_text)
            sap_format = "legacy" if sap_payload is not None else None

    updates: dict[str, Any] = {
        "max_extraction_attempts": clamp_max_extraction_attempts(state.get("max_extraction_attempts")),
    }

    if sap_payload is not None and sap_format == "product_odata":
        raw_document = sap_product_to_raw_document(sap_payload)
        if sku_master_data is None or not sku_master_data.sku:
            sku_master_data = sap_product_to_sku_master_data(sap_payload)

        supplier_block, preselected_contact = select_best_bom_supplier_contact(sap_payload)
        metadata.update(
            {
                "input_format": "sap_product_odata",
                "source_system": "SAP_S4_API_PRODUCT_SRV",
            }
        )
        if supplier_block is not None:
            metadata.update(
                {
                    "supplier_id": supplier_block.supplier_id,
                    "supplier_name": supplier_block.supplier_name,
                    "bom_component": supplier_block.component_description,
                }
            )

        updates["raw_document"] = raw_document
        updates["sku_master_data"] = sku_master_data
        updates["metadata"] = metadata
        updates["sap_export"] = sap_payload
        if preselected_contact is not None:
            metadata["sap_preselected_contact_email"] = preselected_contact.value
            updates["metadata"] = metadata
        return updates

    if sap_payload is not None and sap_format == "legacy":
        raw_document = sap_legacy_to_raw_document(sap_payload)
        if sku_master_data is None or not sku_master_data.sku:
            sku_master_data = sap_legacy_to_sku_master_data(sap_payload)
        material = sap_payload.get("MATERIAL_BASE")
        matnr = material.get("matnr") if isinstance(material, dict) else None
        metadata.update(
            {
                "input_format": "sap_legacy_export",
                "source_system": (sap_payload.get("_metadata") or {}).get("source_system"),
                "supplier_id": str(matnr).lower().replace("_", "-") if matnr else None,
            }
        )
        updates["raw_document"] = raw_document
        updates["sku_master_data"] = sku_master_data
        updates["metadata"] = metadata
        supplier_odata = state.get("supplier_odata") if isinstance(state.get("supplier_odata"), dict) else None
        if supplier_odata is None:
            supplier_odata = sap_legacy_to_supplier_odata(sap_payload)
        if supplier_odata is not None:
            updates["supplier_odata"] = supplier_odata
        return updates

    if _existing_document_text(raw_document) is not None:
        updates["raw_document"] = raw_document
        if sku_master_data is not None:
            updates["sku_master_data"] = sku_master_data
        return updates

    return {
        **updates,
        "errors": [
            "prepare_input_node: provide raw_document.document_text, sap_export, or SAP JSON "
            "(legacy MATERIAL_BASE export or S/4 A_Product OData with to_BillOfMaterial)."
        ],
    }
