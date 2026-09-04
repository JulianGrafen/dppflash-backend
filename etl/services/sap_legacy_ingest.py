"""
Convert messy SAP R/3 legacy JSON exports into pipeline-friendly inputs.
"""

from __future__ import annotations

import json
import re
from typing import Any

from etl.graph.state import RawDocumentInput, SkuMasterData

_SAP_LEGACY_MARKERS = frozenset({"MATERIAL_BASE", "BOM_components_dirty", "Compliance_OCR_DUMP"})


def is_sap_legacy_export(payload: dict[str, Any]) -> bool:
    return bool(_SAP_LEGACY_MARKERS.intersection(payload.keys()))


def _normalize_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("\t", " ")).strip()


def _format_bom_components(bom: dict[str, Any]) -> list[str]:
    lines: list[str] = []
    for key, component in bom.items():
        if not isinstance(component, dict):
            continue
        desc = component.get("desc", "Unknown component")
        cas = component.get("cas_nr", "n/a")
        amount = component.get("amount", "n/a")
        hazard = component.get("hazard")
        hazard_text = f", hazards {', '.join(hazard)}" if isinstance(hazard, list) else ""
        notes = component.get("notes")
        note_text = f" ({notes})" if notes else ""
        lines.append(f"- {key}: {desc}, CAS {cas}, amount {amount}{hazard_text}{note_text}")
    return lines


def _format_custom_fields(fields: list[Any]) -> list[str]:
    lines: list[str] = []
    for item in fields:
        if not isinstance(item, dict):
            continue
        key = item.get("Z_KEY")
        val = item.get("Z_VAL")
        if key:
            lines.append(f"- {key}: {val}")
    return lines


def sap_legacy_to_document_text(payload: dict[str, Any]) -> str:
    """Render SAP legacy export as SDS-like text for the LLM extractor."""
    metadata = payload.get("_metadata") if isinstance(payload.get("_metadata"), dict) else {}
    material = payload.get("MATERIAL_BASE") if isinstance(payload.get("MATERIAL_BASE"), dict) else {}
    custom_fields = payload.get("Z_CUSTOM_FIELDS_EXT")
    bom = payload.get("BOM_components_dirty")
    compliance = payload.get("Compliance_OCR_DUMP")

    lines = [
        "SAP Legacy Material Export",
        f"Source system: {metadata.get('source_system', 'unknown')}",
        f"Export timestamp: {metadata.get('export_timestamp', 'unknown')}",
    ]
    if metadata.get("encoding_errors"):
        lines.append(f"Encoding notes: {metadata['encoding_errors']}")

    lines.extend(
        [
            "",
            "Material master:",
            f"Produktname: {_normalize_whitespace(str(material.get('bez', 'Unknown product')))}",
            f"Artikelnummer (MATNR): {material.get('matnr', 'unknown')}",
            f"GTIN: {_normalize_whitespace(str(material.get('GTIN', '')))}",
            f"Nettogewicht: {material.get('net_wgt', 'unknown')} {material.get('UoM', '')}".strip(),
        ]
    )

    if isinstance(custom_fields, list) and custom_fields:
        lines.extend(["", "Custom SAP fields:", *_format_custom_fields(custom_fields)])

    if isinstance(bom, dict) and bom:
        lines.extend(["", "Abschnitt 3 — Zusammensetzung / BOM:", *_format_bom_components(bom)])

    if compliance:
        lines.extend(["", "Compliance / OCR extract:", str(compliance)])

    return "\n".join(lines)


def sap_legacy_to_sku_master_data(payload: dict[str, Any]) -> SkuMasterData:
    material = payload.get("MATERIAL_BASE") if isinstance(payload.get("MATERIAL_BASE"), dict) else {}
    return SkuMasterData(
        sku=str(material.get("matnr") or "").strip() or None,
        gtin=_normalize_whitespace(str(material.get("GTIN", ""))) or None,
        product_name=_normalize_whitespace(str(material.get("bez", ""))) or None,
    )


def sap_legacy_to_supplier_odata(payload: dict[str, Any]) -> dict[str, Any] | None:
    """Extract SAP business-partner OData contact payload when embedded in legacy export."""
    for key in ("supplier_odata", "SUPPLIER_BP", "SUPPLIER_ODATA", "VENDOR_BP"):
        candidate = payload.get(key)
        if isinstance(candidate, dict) and candidate:
            return candidate
    return None


def sap_legacy_to_raw_document(payload: dict[str, Any]) -> RawDocumentInput:
    material = payload.get("MATERIAL_BASE") if isinstance(payload.get("MATERIAL_BASE"), dict) else {}
    matnr = str(material.get("matnr") or "sap-export").strip()
    safe_name = re.sub(r"[^A-Za-z0-9._-]+", "-", matnr).strip("-") or "sap-export"
    return RawDocumentInput(
        filename=f"{safe_name}.sap.json",
        document_text=sap_legacy_to_document_text(payload),
        product_type_hint="GENERIC",
    )


def coerce_sap_legacy_payload(value: object | None) -> dict[str, Any] | None:
    if value is None:
        return None
    if isinstance(value, dict):
        return value if is_sap_legacy_export(value) else None
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return None
        try:
            parsed = json.loads(stripped)
        except json.JSONDecodeError:
            return None
        return parsed if isinstance(parsed, dict) and is_sap_legacy_export(parsed) else None
    return None
