"""Tests for the master-fallback data-fusion engine (deep_merge_dpp)."""

from __future__ import annotations

from etl.dpp_flash.inbound.fusion import deep_merge_dpp


def test_master_scalar_wins_over_enrichment() -> None:
    # Arrange
    master = {"weight": "12.5 kg"}
    enrichment = {"weight": "99 kg"}

    # Act
    result = deep_merge_dpp(master, enrichment)

    # Assert
    assert result["weight"] == "12.5 kg"


def test_empty_master_values_are_filled() -> None:
    master = {"weight": None, "gtin": "", "safety_warnings": [], "bom": []}
    enrichment = {
        "weight": "12.5 kg",
        "gtin": "4006381333931",
        "safety_warnings": ["H315"],
        "bom": [{"bom_number": "B1"}],
    }

    result = deep_merge_dpp(master, enrichment)

    assert result == {
        "weight": "12.5 kg",
        "gtin": "4006381333931",
        "safety_warnings": ["H315"],
        "bom": [{"bom_number": "B1"}],
    }


def test_missing_master_keys_are_filled() -> None:
    result = deep_merge_dpp({"upi": "UPI-1"}, {"disposal_instructions": "Recycle."})

    assert result["disposal_instructions"] == "Recycle."
    assert result["upi"] == "UPI-1"


def test_empty_enrichment_values_never_overwrite() -> None:
    master = {"weight": "12.5 kg"}
    enrichment = {"weight": None, "gtin": "", "bom": []}

    result = deep_merge_dpp(master, enrichment)

    assert result == {"weight": "12.5 kg"}


def test_nested_dict_merges_recursively() -> None:
    master = {"supplier_contact": {"name": "SAP Name", "email": None}}
    enrichment = {"supplier_contact": {"name": "SDS Name", "email": "a@b.de"}}

    result = deep_merge_dpp(master, enrichment)

    assert result["supplier_contact"] == {"name": "SAP Name", "email": "a@b.de"}


def test_bom_items_merge_by_bom_number() -> None:
    master = {
        "bom": [
            {"bom_number": "B1", "component_description": None, "supplier_contact": {"name": "S1", "email": None}},
            {"bom_number": "B2", "component_description": "Zement"},
        ]
    }
    enrichment = {
        "bom": [
            # Different order on purpose — alignment must use bom_number, not index.
            {"bom_number": "B2", "component_description": "OVERWRITE ATTEMPT"},
            {"bom_number": "B1", "component_description": "Quarz", "supplier_contact": {"email": "s1@x.de"}},
            {"bom_number": "B3", "component_description": "Wasser"},
        ]
    }

    result = deep_merge_dpp(master, enrichment)

    by_number = {item["bom_number"]: item for item in result["bom"]}
    assert by_number["B1"]["component_description"] == "Quarz"
    assert by_number["B1"]["supplier_contact"] == {"name": "S1", "email": "s1@x.de"}
    assert by_number["B2"]["component_description"] == "Zement"  # master wins
    assert by_number["B3"]["component_description"] == "Wasser"  # gap appended


def test_bom_items_merge_by_index_without_match_key() -> None:
    master = {"bom": [{"component_description": None, "svhc_status": "none"}]}
    enrichment = {"bom": [{"component_description": "Quarz", "svhc_status": "SVHC!"}]}

    result = deep_merge_dpp(master, enrichment)

    assert result["bom"] == [{"component_description": "Quarz", "svhc_status": "none"}]


def test_inputs_are_not_mutated() -> None:
    master = {"bom": [{"bom_number": "B1", "component_description": None}]}
    enrichment = {"bom": [{"bom_number": "B1", "component_description": "Quarz"}]}
    master_snapshot = {"bom": [{"bom_number": "B1", "component_description": None}]}

    deep_merge_dpp(master, enrichment)

    assert master == master_snapshot
