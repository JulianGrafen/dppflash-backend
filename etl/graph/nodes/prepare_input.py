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
)


def _existing_document_text(raw_document: RawDocumentInput | None) -> str | None:
    if raw_document is None:
        return None
    text = (raw_document.document_text or "").strip()
    return text or None


async def prepare_input_node(state: DppGraphState) -> dict[str, Any]:
    """
    Accept standard ``raw_document`` input or a SAP legacy export blob.

    Studio users can pass either:
    - ``{"raw_document": {"document_text": "..."}}``
    - ``{"sap_export": { ... MATERIAL_BASE, BOM_components_dirty, ... }}``
    - the SAP JSON fields directly at the top level of the input object
    """
    raw_document = coerce_raw_document(state.get("raw_document"))
    sku_master_data = coerce_sku_master_data(state.get("sku_master_data"))
    metadata = dict(state.get("metadata") or {})

    sap_payload = coerce_sap_legacy_payload(state.get("sap_export"))
    if sap_payload is None and isinstance(state, dict):
        candidate = {key: value for key, value in state.items() if not key.startswith("_")}
        if is_sap_legacy_export(candidate):
            sap_payload = candidate

    if sap_payload is None and raw_document is not None:
        sap_payload = coerce_sap_legacy_payload(raw_document.document_text)

    updates: dict[str, Any] = {
        "max_extraction_attempts": clamp_max_extraction_attempts(state.get("max_extraction_attempts")),
    }

    if sap_payload is not None:
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
        return updates

    if _existing_document_text(raw_document) is not None:
        updates["raw_document"] = raw_document
        if sku_master_data is not None:
            updates["sku_master_data"] = sku_master_data
        return updates

    return {
        **updates,
        "errors": [
            "prepare_input_node: provide raw_document.document_text, sap_export, or SAP legacy JSON "
            "(MATERIAL_BASE + BOM_components_dirty)."
        ],
    }
