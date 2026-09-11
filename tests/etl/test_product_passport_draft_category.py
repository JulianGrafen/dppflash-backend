from __future__ import annotations

import pytest
from pydantic import ValidationError

from etl.dpp_flash.inbound.category_requirements import validate_universal_draft_fields
from etl.dpp_flash.inbound.draft_to_analysis import passport_draft_to_analysis_result
from etl.dpp_flash.inbound.models import ProductPassportDraft
from etl.models.audit_field import audit_value
from etl.models.dpp_schemas import ProductCategory


def test_electronics_requires_repairability_and_composition() -> None:
    with pytest.raises(ValidationError) as exc_info:
        ProductPassportDraft(
            upi="E-1",
            category=ProductCategory.ELECTRONICS,
        )
    messages = [err["msg"] for err in exc_info.value.errors()]
    assert any("repairability_info" in msg for msg in messages)


def test_electronics_passes_with_required_fields() -> None:
    draft = ProductPassportDraft(
        upi="E-2",
        category=ProductCategory.ELECTRONICS,
        repairability_info="Index 7/10",
        material_composition="Steel 60%, Plastic 40%",
    )
    assert draft.category == ProductCategory.ELECTRONICS


def test_chemicals_requires_contains_svhc() -> None:
    with pytest.raises(ValidationError) as exc_info:
        ProductPassportDraft(upi="C-1", category=ProductCategory.CHEMICALS)
    messages = [err["msg"] for err in exc_info.value.errors()]
    assert any("contains_svhc" in msg for msg in messages)


def test_chemicals_allows_false_svhc_without_repairability() -> None:
    draft = ProductPassportDraft(
        upi="C-2",
        category=ProductCategory.CHEMICALS,
        contains_svhc="false",
        repairability_info=None,
    )
    assert draft.contains_svhc == "false"


def test_generic_allows_empty_optional_metrics() -> None:
    draft = ProductPassportDraft(upi="G-1", category=ProductCategory.GENERIC)
    assert draft.repairability_info is None


def test_category_alias_textiles_maps_to_textiles_apparel() -> None:
    draft = ProductPassportDraft(upi="T-1", category="TEXTILES")
    assert draft.category == ProductCategory.TEXTILES_APPAREL


def test_validate_universal_requires_taric_and_manufacturer() -> None:
    draft = ProductPassportDraft(upi="U-1", category=ProductCategory.GENERIC)
    with pytest.raises(ValueError, match="manufacturer_name"):
        validate_universal_draft_fields(draft)

    draft = ProductPassportDraft(
        upi="U-2",
        manufacturer_name="Acme GmbH",
        category=ProductCategory.GENERIC,
    )
    with pytest.raises(ValueError, match="taric_code"):
        validate_universal_draft_fields(draft)


def test_passport_draft_maps_category_and_taric() -> None:
    draft = ProductPassportDraft(
        upi="LOC-1",
        category=ProductCategory.ELECTRONICS,
        manufacturer_name="TechVolt GmbH",
        taric_code="8544 70 00",
        repairability_info="7/10",
        material_composition="Cu 50%, PVC 50%",
    )
    result = passport_draft_to_analysis_result(draft)
    assert result.product_category == ProductCategory.ELECTRONICS
    assert audit_value(result.identification.commodity_code_taric) == "8544 70 00"
