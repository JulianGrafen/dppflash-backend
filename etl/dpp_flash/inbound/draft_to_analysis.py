"""Map inbound ProductPassportDraft rows to DPPAnalysisResult for ESPR validation."""

from __future__ import annotations

from typing import Any

from pydantic import ValidationError

from etl.dpp_flash.inbound.category_requirements import effective_manufacturer_name
from etl.dpp_flash.inbound.models import BillOfMaterialItem, Contact, ProductPassportDraft
from etl.models.audit_field import AuditField, is_audit_field_filled
from etl.models.dpp_schemas import (
    DPPAnalysisResult,
    DPPIdentification,
    DPPEconomicOperator,
    ProductCategory,
    _CATEGORY_PRODUCT_DETAILS,
    _CATEGORY_SUSTAINABILITY,
    reassign_analysis_category,
)


def _erp_field(value: str | None, source_detail: str) -> AuditField | None:
    if value is None or not str(value).strip():
        return None
    return AuditField.from_erp_master(str(value).strip(), source_detail)


def _svhc_audit_field(value: str | None) -> AuditField | None:
    if value is None or not str(value).strip():
        return None
    text = str(value).strip()
    lowered = text.casefold()
    if lowered in {"true", "yes", "ja", "1", "y"}:
        return AuditField.from_erp_master(True, source_detail="ERP: SVHC/REACH")
    if lowered in {"false", "no", "nein", "0", "n"}:
        return AuditField.from_erp_master(False, source_detail="ERP: SVHC/REACH")
    return AuditField.from_erp_master(text, source_detail="ERP: SVHC/REACH")


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
    product_category: ProductCategory | None = None,
) -> DPPAnalysisResult:
    """Build a minimal DPPAnalysisResult from a flat inbound draft (ERP/Excel master)."""
    category = product_category or draft.category
    safety_text = "; ".join(draft.safety_warnings) if draft.safety_warnings else None
    composition = draft.material_composition or _bom_to_composition_text(draft.bom)
    manufacturer = effective_manufacturer_name(draft)

    identification = DPPIdentification(
        unique_product_identifier=_erp_field(draft.upi, "ERP: Artikelnummer/SKU"),
        gtin_or_equivalent=_erp_field(draft.gtin, "ERP: GTIN/EAN"),
        commodity_code_taric=_erp_field(draft.taric_code, "ERP: TARIC/Zolltarif"),
    )

    herstelleradresse = draft.herstelleradresse or draft.manufacturer_address
    economic_operator = None
    if any((manufacturer, herstelleradresse, draft.kontakt, draft.eori)):
        economic_operator = DPPEconomicOperator(
            manufacturer_name=_erp_field(manufacturer, "ERP: Hersteller"),
            manufacturer_address=_erp_field(herstelleradresse, "ERP: Herstelleradresse"),
            electronic_contact_details=_erp_field(
                _format_kontakt(draft.kontakt),
                "ERP: Kontakt",
            ),
            unique_operator_identifier=_erp_field(draft.eori, "ERP: EORI"),
        )

    details_cls = _CATEGORY_PRODUCT_DETAILS[category]
    product_details = details_cls(
        category=category,
        product_weight=_erp_field(draft.weight, "ERP: Gewicht"),
        warnings_safety_information=_erp_field(safety_text, "ERP: Sicherheitshinweise"),
        contains_svhc=_svhc_audit_field(draft.contains_svhc),
    )

    sustainability_cls = _CATEGORY_SUSTAINABILITY[category]
    sustainability_fields: dict[str, Any] = {"category": category}
    if draft.disposal_instructions:
        sustainability_fields["end_of_life_treatment"] = _erp_field(
            draft.disposal_instructions,
            "ERP: Entsorgungshinweise",
        )
    if composition:
        sustainability_fields["material_composition"] = _erp_field(
            composition,
            "ERP: Materialzusammensetzung",
        )
    if draft.repairability_info:
        sustainability_fields["repairability_info"] = _erp_field(
            draft.repairability_info,
            "ERP: Reparierbarkeit",
        )
    if draft.recyclability_info:
        sustainability_fields["recyclability_info"] = _erp_field(
            draft.recyclability_info,
            "ERP: Recyclingfähigkeit",
        )
    sustainability = sustainability_cls(**sustainability_fields) if len(sustainability_fields) > 1 else None

    return DPPAnalysisResult(
        product_category=category,
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
        extraction.identification.commodity_code_taric = _overlay_audit_field(
            extraction.identification.commodity_code_taric,
            erp.identification.commodity_code_taric,
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
            extraction.product_details.contains_svhc = _overlay_audit_field(
                extraction.product_details.contains_svhc,
                erp.product_details.contains_svhc,
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
            extraction.sustainability.repairability_info = _overlay_audit_field(
                extraction.sustainability.repairability_info,
                erp.sustainability.repairability_info,
            )
            extraction.sustainability.recyclability_info = _overlay_audit_field(
                extraction.sustainability.recyclability_info,
                erp.sustainability.recyclability_info,
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
    # Draft category wins when explicitly set (non-GENERIC); otherwise keep PDF inference.
    if draft.category != ProductCategory.GENERIC:
        merged = reassign_analysis_category(merged, draft.category)
    else:
        merged.product_category = extraction.product_category
    return merged
