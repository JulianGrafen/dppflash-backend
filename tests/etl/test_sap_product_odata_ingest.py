"""Tests for SAP A_Product OData BOM supplier contact extraction."""

from __future__ import annotations

import asyncio

from etl.graph.nodes.prepare_input import prepare_input_node
from etl.services.sap_product_odata_ingest import (
    is_sap_product_odata,
    iter_bom_supplier_blocks,
    sap_product_to_sku_master_data,
    select_best_bom_supplier_contact,
)

SAMPLE_A_PRODUCT = {
    "d": {
        "Product": "000000000010048921",
        "NetWeight": "25.000",
        "WeightUnit": "KG",
        "CountryOfOrigin": "DE",
        "CommodityCode": "35069190",
        "StandardIdentifier": {
            "ProductStandardID": "04001234987654",
            "InternationalArticleNumberCat": "EAN",
        },
        "to_Description": {
            "results": [
                {
                    "Language": "DE",
                    "ProductDescription": "LOCTITE IND-SEAL 400 - Gebinde 25KG",
                }
            ]
        },
        "to_BillOfMaterial": {
            "results": [
                {
                    "BillOfMaterial": "00012844",
                    "to_BOMItems": {
                        "results": [
                            {
                                "BOMItemNumber": "0010",
                                "ComponentDescription": "Vorpolymer Polyol Type P-40",
                                "to_PurchasingInfo": {
                                    "Supplier": "0000100452",
                                    "SupplierName": "Covestro Deutschland AG",
                                    "to_SupplierDetails": {
                                        "Supplier": "0000100452",
                                        "DefaultEmailAddress": "rechnungseingang@covestro.corp",
                                        "to_ContactPerson": {
                                            "results": [
                                                {
                                                    "ContactPersonID": "0000084112",
                                                    "FirstName": "Stefan",
                                                    "LastName": "Meier",
                                                    "Department": "Technical Sales Coatings & Adhesives",
                                                    "EmailAddress": "stefan.meier@covestro.corp",
                                                }
                                            ]
                                        },
                                    },
                                },
                            },
                            {
                                "BOMItemNumber": "0020",
                                "ComponentDescription": "Kreide-Füllstoff Calcit Micron",
                                "to_PurchasingInfo": {
                                    "Supplier": "0000103891",
                                    "SupplierName": "Omya GmbH",
                                    "to_SupplierDetails": {
                                        "DefaultEmailAddress": "info.germany@omya.corp",
                                        "to_ContactPerson": {"results": []},
                                    },
                                },
                            },
                            {
                                "BOMItemNumber": "0030",
                                "ComponentDescription": "Reaktiver Härtungsbeschleuniger X-9",
                                "to_PurchasingInfo": {
                                    "Supplier": "0000109923",
                                    "SupplierName": "Specialty Chem Distribution B.V.",
                                    "to_SupplierDetails": {
                                        "DefaultEmailAddress": "ap-invoices@spec-chem.nl",
                                        "to_ContactPerson": {"results": []},
                                    },
                                },
                            },
                        ]
                    },
                }
            ]
        },
    }
}


def test_is_sap_product_odata() -> None:
    assert is_sap_product_odata(SAMPLE_A_PRODUCT) is True
    assert is_sap_product_odata({"MATERIAL_BASE": {}}) is False


def test_iter_bom_supplier_blocks_finds_three_suppliers() -> None:
    blocks = iter_bom_supplier_blocks(SAMPLE_A_PRODUCT["d"])
    assert len(blocks) == 3
    assert blocks[0].supplier_name == "Covestro Deutschland AG"
    assert blocks[0].contact_persons[0]["FirstName"] == "Stefan"


def test_select_best_bom_supplier_contact_prefers_technical_sales() -> None:
    block, contact = select_best_bom_supplier_contact(SAMPLE_A_PRODUCT)
    assert block is not None
    assert block.supplier_name == "Covestro Deutschland AG"
    assert contact is not None
    assert contact.value == "stefan.meier@covestro.corp"
    assert "Covestro" in (contact.source_detail or "")
    assert "Stefan" in (contact.source_detail or "") or "Technical" in (contact.source_detail or "")


def test_sap_product_to_sku_master_data() -> None:
    sku = sap_product_to_sku_master_data(SAMPLE_A_PRODUCT)
    assert sku.sku == "000000000010048921"
    assert sku.gtin == "04001234987654"
    assert sku.product_name == "LOCTITE IND-SEAL 400 - Gebinde 25KG"
    assert sku.taric_code == "35069190"


def test_prepare_input_node_accepts_sap_product_export() -> None:
    update = asyncio.run(
        prepare_input_node({"sap_export": SAMPLE_A_PRODUCT, "max_extraction_attempts": 3})  # type: ignore[arg-type]
    )

    assert "errors" not in update
    assert update["metadata"]["input_format"] == "sap_product_odata"
    assert update["metadata"]["supplier_name"] == "Covestro Deutschland AG"
    assert update["sap_export"] is not None
    assert update["sku_master_data"].sku == "000000000010048921"
    assert "LOCTITE IND-SEAL 400" in update["raw_document"].document_text
