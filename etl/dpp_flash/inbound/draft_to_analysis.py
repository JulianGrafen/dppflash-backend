"""Map inbound ProductPassportDraft rows to DPPAnalysisResult for ESPR validation."""

from __future__ import annotations

from typing import Any

from pydantic import ValidationError

from etl.dpp_flash.inbound.models import BillOfMaterialItem, Contact, ProductPassportDraft
from etl.models.audit_field import AuditField, is_audit_field_filled
from etl.models.dpp_schemas import (
    DPPAnalysisResult,
    DPPIdentification,
    DPPEconomicOperator,
    GenericProductDetails,
    GenericSustainability,
    ProductCategory,
)


def _erp_field(value: str | None, source_detail: str) -> AuditField | None:
    if value is None or not str(value).strip():
        return None
    return AuditField.from_erp_master(str(value).strip(), source_detail)


def _bom_to_composition_text(bom: list[BillOfMaterialItem]) -> str | None:
    if not bom:
        return None
    lines: list[str] = []
    for item in bom:
        parts = [item.bom_number or "?", item.component_description or ""]
        if item.svhc_status:
            parts.append(f"SVHC: {item.svhc_status}")
        if item.co2_footprint:
            parts.append(f"CO2: {item.co2_footprint}")
        lines.append(" — ".join(part for part in parts if part))
    return "; ".join(lines) if lines else None


def _format_kontakt(kontakt: Contact | None) -> str | None:
    if kontakt is None:
        return None
    parts = [part for part in (kontakt.name, kontakt.email, kontakt.phone) if part]
    return " · ".join(parts) if parts else None


def passport_draft_to_analysis_result(
    draft: ProductPassportDraft,
    *,
    product_category: ProductCategory = ProductCategory.GENERIC,
) -> DPPAnalysisResult:
    """Build a minimal DPPAnalysisResult from a flat inbound draft (ERP/Excel master)."""
    safety_text = "; ".join(draft.safety_warnings) if draft.safety_warnings else None
    composition = _bom_to_composition_text(draft.bom)

    identification = DPPIdentification(
        unique_product_identifier=_erp_field(draft.upi, "ERP: Artikelnummer/SKU"),
        gtin_or_equivalent=_erp_field(draft.gtin, "ERP: GTIN/EAN"),
    )

    herstelleradresse = draft.herstelleradresse or draft.manufacturer_address
    economic_operator = None
    if any((draft.hersteller, herstelleradresse, draft.kontakt, draft.eori)):
        economic_operator = DPPEconomicOperator(
            manufacturer_name=_erp_field(draft.hersteller, "ERP: Hersteller"),
            manufacturer_address=_erp_field(herstelleradresse, "ERP: Herstelleradresse"),
            electronic_contact_details=_erp_field(
                _format_kontakt(draft.kontakt),
                "ERP: Kontakt",
            ),
            unique_operator_identifier=_erp_field(draft.eori, "ERP: EORI"),
        )

    product_details = GenericProductDetails(
        product_weight=_erp_field(draft.weight, "ERP: Gewicht"),
        warnings_safety_information=_erp_field(safety_text, "ERP: Sicherheitshinweise"),
    )

    sustainability = None
    if draft.disposal_instructions or composition:
        sustainability = GenericSustainability(
            end_of_life_treatment=_erp_field(
                draft.disposal_instructions,
                "ERP: Entsorgungshinweise",
            ),
            material_composition=_erp_field(composition, "ERP: Stückliste/BOM"),
        )

    return DPPAnalysisResult(
        product_category=product_category,
        identification=identification,
        economic_operator=economic_operator,
        product_details=product_details,
        sustainability=sustainability,
    )


def _overlay_audit_field(target: AuditField | None, source: AuditField | None) -> AuditField | None:
    if source is None or not is_audit_field_filled(source):
        return target
    if target is None or not is_audit_field_filled(target):
        return source
    return target


def _overlay_erp_on_extraction(
    extraction: DPPAnalysisResult,
    erp: DPPAnalysisResult,
) -> DPPAnalysisResult:
    """Fill empty extraction audit fields from ERP master data (master-fallback)."""
    if erp.identification and extraction.identification:
        extraction.identification.unique_product_identifier = _overlay_audit_field(
            extraction.identification.unique_product_identifier,
            erp.identification.unique_product_identifier,
        )
        extraction.identification.gtin_or_equivalent = _overlay_audit_field(
            extraction.identification.gtin_or_equivalent,
            erp.identification.gtin_or_equivalent,
        )
    elif erp.identification and extraction.identification is None:
        extraction.identification = erp.identification

    if erp.economic_operator:
        if extraction.economic_operator is None:
            extraction.economic_operator = erp.economic_operator
        else:
            extraction.economic_operator.manufacturer_name = _overlay_audit_field(
                extraction.economic_operator.manufacturer_name,
                erp.economic_operator.manufacturer_name,
            )
            extraction.economic_operator.manufacturer_address = _overlay_audit_field(
                extraction.economic_operator.manufacturer_address,
                erp.economic_operator.manufacturer_address,
            )
            extraction.economic_operator.electronic_contact_details = _overlay_audit_field(
                extraction.economic_operator.electronic_contact_details,
                erp.economic_operator.electronic_contact_details,
            )
            extraction.economic_operator.unique_operator_identifier = _overlay_audit_field(
                extraction.economic_operator.unique_operator_identifier,
                erp.economic_operator.unique_operator_identifier,
            )

    if erp.product_details:
        if extraction.product_details is None:
            extraction.product_details = erp.product_details
        else:
            extraction.product_details.product_weight = _overlay_audit_field(
                extraction.product_details.product_weight,
                erp.product_details.product_weight,
            )
            extraction.product_details.warnings_safety_information = _overlay_audit_field(
                extraction.product_details.warnings_safety_information,
                erp.product_details.warnings_safety_information,
            )

    if erp.sustainability:
        if extraction.sustainability is None:
            extraction.sustainability = erp.sustainability
        else:
            extraction.sustainability.end_of_life_treatment = _overlay_audit_field(
                extraction.sustainability.end_of_life_treatment,
                erp.sustainability.end_of_life_treatment,
            )
            extraction.sustainability.material_composition = _overlay_audit_field(
                extraction.sustainability.material_composition,
                erp.sustainability.material_composition,
            )

    return extraction


def resolve_analysis_for_validation(
    draft: ProductPassportDraft,
    raw_extraction: dict[str, Any] | None = None,
) -> DPPAnalysisResult:
    """Single entry point: ERP draft + optional PDF extraction JSON for validation."""
    erp_analysis = passport_draft_to_analysis_result(draft)
    if not raw_extraction:
        return erp_analysis

    try:
        extraction = DPPAnalysisResult.model_validate(raw_extraction)
    except ValidationError:
        return erp_analysis

    merged = _overlay_erp_on_extraction(extraction, erp_analysis)
    merged.product_category = extraction.product_category
    return merged
