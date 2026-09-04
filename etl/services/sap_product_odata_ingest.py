"""
Ingest SAP S/4HANA API_PRODUCT_SRV A_Product OData JSON for the DPP pipeline.

Walks BOM purchasing info → supplier details → to_ContactPerson and selects the
best compliance-relevant contact across all BOM components via ContactScorer.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any

from etl.graph.state import RawDocumentInput, SkuMasterData
from etl.models.audit_field import AuditField, audit_text
from etl.services.contact_scorer import ContactScorer

_SAP_PRODUCT_MARKERS = frozenset({"Product", "to_BillOfMaterial", "to_Description"})


@dataclass(frozen=True)
class BomSupplierContactBlock:
    """One BOM component's purchasing supplier with contact OData."""

    supplier_id: str
    supplier_name: str
    component_description: str
    bom_item_number: str
    default_email_address: str | None
    contact_persons: list[dict[str, Any]]

    def to_supplier_odata(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "DefaultEmailAddress": self.default_email_address,
            "to_ContactPerson": self.contact_persons,
        }
        return payload


def is_sap_product_odata(payload: dict[str, Any]) -> bool:
    """True when payload looks like an A_Product OData entity (optionally wrapped in ``d``)."""
    entity = unwrap_product_entity(payload)
    return bool(_SAP_PRODUCT_MARKERS.intersection(entity.keys()))


def unwrap_product_entity(payload: dict[str, Any]) -> dict[str, Any]:
    if "d" in payload and isinstance(payload["d"], dict):
        return payload["d"]
    return payload


def _unwrap_results(raw: Any) -> list[Any]:
    if isinstance(raw, list):
        return raw
    if isinstance(raw, dict):
        results = raw.get("results")
        if isinstance(results, list):
            return results
    return []


def iter_bom_supplier_blocks(product: dict[str, Any]) -> list[BomSupplierContactBlock]:
    """Collect supplier/contact blocks from all BOM line items."""
    blocks: list[BomSupplierContactBlock] = []

    for bom_header in _unwrap_results(product.get("to_BillOfMaterial")):
        if not isinstance(bom_header, dict):
            continue
        for bom_item in _unwrap_results(bom_header.get("to_BOMItems")):
            if not isinstance(bom_item, dict):
                continue

            purchasing = bom_item.get("to_PurchasingInfo")
            if not isinstance(purchasing, dict):
                continue

            supplier_details = purchasing.get("to_SupplierDetails")
            if not isinstance(supplier_details, dict):
                continue

            contact_persons: list[dict[str, Any]] = []
            for person in _unwrap_results(supplier_details.get("to_ContactPerson")):
                if isinstance(person, dict):
                    contact_persons.append(person)

            default_email = supplier_details.get("DefaultEmailAddress")
            if isinstance(default_email, str):
                default_email = default_email.strip() or None
            else:
                default_email = None

            if not contact_persons and not default_email:
                continue

            blocks.append(
                BomSupplierContactBlock(
                    supplier_id=str(purchasing.get("Supplier") or supplier_details.get("Supplier") or "").strip(),
                    supplier_name=str(purchasing.get("SupplierName") or "").strip(),
                    component_description=str(bom_item.get("ComponentDescription") or "").strip(),
                    bom_item_number=str(bom_item.get("BOMItemNumber") or "").strip(),
                    default_email_address=default_email,
                    contact_persons=contact_persons,
                )
            )

    return blocks


def _parse_score(source_detail: str | None) -> int:
    if not source_detail:
        return -999
    match = re.search(r"score=(-?\d+)", source_detail)
    return int(match.group(1)) if match else -999


def select_best_bom_supplier_contact(product: dict[str, Any]) -> tuple[BomSupplierContactBlock | None, AuditField | None]:
    """
    Score all BOM supplier contact payloads and return the winning block + AuditField.
    """
    entity = unwrap_product_entity(product)
    blocks = iter_bom_supplier_blocks(entity)
    if not blocks:
        return None, None

    scorer = ContactScorer()
    best_block: BomSupplierContactBlock | None = None
    best_contact: AuditField | None = None
    best_score = scorer.MIN_ACCEPTABLE_SCORE - 1

    for block in blocks:
        candidate = scorer.get_best_contact(block.to_supplier_odata())
        if candidate is None:
            continue
        score = _parse_score(candidate.source_detail)
        if score > best_score:
            best_score = score
            best_block = block
            best_contact = candidate

    if best_block is None or best_contact is None:
        return None, None

    context = _format_supplier_context(best_block)
    enriched = best_contact.model_copy(
        update={
            "source_detail": f"{context} · {best_contact.source_detail or ''}".strip(" ·"),
        }
    )
    return best_block, enriched


def _format_supplier_context(block: BomSupplierContactBlock) -> str:
    parts = [part for part in (block.supplier_name, block.component_description) if part]
    prefix = " / ".join(parts) if parts else block.supplier_id or "BOM supplier"
    if block.bom_item_number:
        return f"{prefix} (BOM {block.bom_item_number})"
    return prefix


def sap_product_to_supplier_odata(product: dict[str, Any]) -> dict[str, Any] | None:
    """Return flat ContactScorer payload for the best BOM supplier contact."""
    block, _ = select_best_bom_supplier_contact(product)
    if block is None:
        return None
    return block.to_supplier_odata()


def sap_product_to_sku_master_data(product: dict[str, Any]) -> SkuMasterData:
    entity = unwrap_product_entity(product)

    product_id = str(entity.get("Product") or "").strip() or None
    gtin: str | None = None
    standard_id = entity.get("StandardIdentifier")
    if isinstance(standard_id, dict):
        gtin = str(standard_id.get("ProductStandardID") or "").strip() or None

    product_name: str | None = None
    for row in _unwrap_results(entity.get("to_Description")):
        if not isinstance(row, dict):
            continue
        if row.get("Language") == "DE":
            product_name = str(row.get("ProductDescription") or "").strip() or None
            break
    if product_name is None:
        for row in _unwrap_results(entity.get("to_Description")):
            if isinstance(row, dict) and row.get("ProductDescription"):
                product_name = str(row["ProductDescription"]).strip()
                break

    taric_code = str(entity.get("CommodityCode") or "").strip() or None

    return SkuMasterData(
        sku=product_id,
        gtin=gtin,
        product_name=product_name,
        taric_code=taric_code,
    )


def sap_product_to_document_text(product: dict[str, Any]) -> str:
    """Render A_Product OData as SDS-like text for the LLM extractor."""
    entity = unwrap_product_entity(product)
    sku = sap_product_to_sku_master_data(product)

    lines = [
        "SAP S/4HANA A_Product OData Export",
        f"Produktname: {sku.product_name or 'Unknown product'}",
        f"Artikelnummer (Product): {sku.sku or 'unknown'}",
        f"GTIN: {sku.gtin or 'unknown'}",
        f"TARIC / CommodityCode: {sku.taric_code or 'unknown'}",
        f"Nettogewicht: {entity.get('NetWeight', 'unknown')} {entity.get('WeightUnit', '')}".strip(),
        f"Herkunftsland: {entity.get('CountryOfOrigin', 'unknown')}",
    ]

    classifications = _unwrap_results(entity.get("to_ProductClassification"))
    if classifications:
        lines.extend(["", "Produktklassifikation:"])
        for row in classifications:
            if not isinstance(row, dict):
                continue
            char = row.get("Characteristic")
            val = row.get("CharacteristicValue")
            desc = row.get("CharcValueDescription")
            lines.append(f"- {char}: {val} ({desc})")

    blocks = iter_bom_supplier_blocks(entity)
    if blocks:
        lines.extend(["", "Abschnitt 3 — Stückliste / BOM:"])
        for block in blocks:
            lines.append(f"- {block.component_description or block.bom_item_number}: Lieferant {block.supplier_name}")

    return "\n".join(lines)


def sap_product_to_raw_document(product: dict[str, Any]) -> RawDocumentInput:
    entity = unwrap_product_entity(product)
    product_id = str(entity.get("Product") or "sap-product").strip()
    safe_name = re.sub(r"[^A-Za-z0-9._-]+", "-", product_id).strip("-") or "sap-product"
    return RawDocumentInput(
        filename=f"{safe_name}.sap-product.json",
        document_text=sap_product_to_document_text(product),
        product_type_hint="GENERIC",
    )


def coerce_sap_product_payload(value: object | None) -> dict[str, Any] | None:
    if value is None:
        return None
    if isinstance(value, dict):
        return value if is_sap_product_odata(value) else None
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return None
        try:
            parsed = json.loads(stripped)
        except json.JSONDecodeError:
            return None
        return parsed if isinstance(parsed, dict) and is_sap_product_odata(parsed) else None
    return None
