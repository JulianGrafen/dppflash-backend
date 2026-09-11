"""Tests for rule-based product category classification."""

from __future__ import annotations

from etl.models.dpp_schemas import ProductCategory
from etl.services.product_category_classifier import (
    classify_product_category,
    refine_product_category,
)


def test_classify_battery_from_un3480() -> None:
    corpus = "Transport according to UN 3480. Lithium-ion portable battery 3.7 V, 5000 mAh."
    result = classify_product_category(corpus, "battery-sds.pdf")
    assert result.category == ProductCategory.BATTERIES
    assert result.confidence > 0.4


def test_classify_textiles_from_fibre_percent() -> None:
    corpus = "Material: 80 % Baumwolle, 20 % Polyester. Oeko-Tex Standard 100."
    result = classify_product_category(corpus)
    assert result.category == ProductCategory.TEXTILES_APPAREL


def test_classify_electronics_from_rohs_weee() -> None:
    corpus = "RoHS compliant. WEEE registration. Rated voltage 230 V AC."
    result = classify_product_category(corpus)
    assert result.category == ProductCategory.ELECTRONICS


def test_classify_generic_adhesive() -> None:
    corpus = "Klebstoff auf Epoxidharzbasis. Abschnitt 3: Quarz 50%, Harz 50%."
    result = classify_product_category(corpus)
    assert result.category == ProductCategory.CHEMICALS


def test_refine_upgrades_generic_to_battery() -> None:
    corpus = "UN 3480 lithium ion cell 48 Wh"
    category, reason = refine_product_category(ProductCategory.GENERIC, corpus)
    assert category == ProductCategory.BATTERIES
    assert reason is not None
    assert "upgraded" in reason


def test_refine_keeps_llm_when_no_rule_signal() -> None:
    category, reason = refine_product_category(
        ProductCategory.ELECTRONICS,
        "Simple product description without regulatory keywords.",
    )
    assert category == ProductCategory.ELECTRONICS
    assert reason is None
