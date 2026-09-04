"""Tests for SAP legacy export ingestion."""

from __future__ import annotations

import asyncio

from etl.graph.nodes.prepare_input import prepare_input_node
from etl.services.sap_legacy_ingest import (
    is_sap_legacy_export,
    sap_legacy_to_document_text,
    sap_legacy_to_sku_master_data,
)

SAMPLE_SAP_EXPORT = {
    "_metadata": {
        "source_system": "SAP_R3_LEGACY_V4.2",
        "export_timestamp": "2026-09-03T23:51:12",
        "encoding_errors": "UTF-8 conversion failed on 2 nodes",
    },
    "MATERIAL_BASE": {
        "matnr": "HENK-X99-PROD",
        "bez": "Industrieklebstoff X99\t(Experimental_Batch)",
        "GTIN": " 04001234567890 ",
        "net_wgt": "25,0",
        "UoM": "KGM",
    },
    "Z_CUSTOM_FIELDS_EXT": [
        {"Z_KEY": "MASS_BAL_CHECK", "Z_VAL": "Total approx. 99.8% (0.2% evaporation loss in proc.)"},
    ],
    "BOM_components_dirty": {
        "comp_1": {
            "desc": "Polyurethane Resin (Binder)",
            "cas_nr": "9009-54-5",
            "amount": "60-65%",
            "hazard": ["H315", "H319"],
        },
        "comp_3": {
            "desc": "Calciumcarbonat",
            "cas_nr": "471 34 1",
            "amount": "Rest to 100%",
        },
    },
    "Compliance_OCR_DUMP": (
        "SEC_1: HAZARD IDENTIFICATION. Contains Diisocyanates (CAS: 4098-71-9 ) @ 0.45 p.p.m."
    ),
}


def test_is_sap_legacy_export() -> None:
    assert is_sap_legacy_export(SAMPLE_SAP_EXPORT) is True
    assert is_sap_legacy_export({"raw_document": {}}) is False


def test_sap_legacy_to_document_text_contains_key_fields() -> None:
    text = sap_legacy_to_document_text(SAMPLE_SAP_EXPORT)
    assert "HENK-X99-PROD" in text
    assert "Industrieklebstoff X99" in text
    assert "Polyurethane Resin" in text
    assert "Compliance / OCR extract" in text


def test_sap_legacy_to_sku_master_data() -> None:
    sku = sap_legacy_to_sku_master_data(SAMPLE_SAP_EXPORT)
    assert sku.sku == "HENK-X99-PROD"
    assert sku.gtin == "04001234567890"
    assert "Industrieklebstoff X99" in (sku.product_name or "")


def test_prepare_input_node_accepts_sap_export() -> None:
    update = asyncio.run(
        prepare_input_node({"sap_export": SAMPLE_SAP_EXPORT, "max_extraction_attempts": 5000})  # type: ignore[arg-type]
    )

    assert "errors" not in update
    assert update["raw_document"].document_text
    assert "HENK-X99-PROD" in update["raw_document"].document_text
    assert update["sku_master_data"].sku == "HENK-X99-PROD"
    assert update["metadata"]["input_format"] == "sap_legacy_export"
    assert update["max_extraction_attempts"] == 5
