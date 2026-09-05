"""
Gap enrichment — Stufe 1 (SPHIER/EPRM API) + Stufe 2 (Supplier Outreach).

Enterprise integration points; default implementations use ERP master data and
configurable mock responses for local development.
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from typing import Any

from etl.graph.state import (
    ComplianceStatus,
    DbPersistResult,
    EnrichmentAttemptResult,
    EnrichmentStage,
    GapRecord,
    SkuMasterData,
)
from etl.models.audit_field import AuditField, audit_text, audit_value, is_audit_field_filled
from etl.models.dpp_schemas import DPPAnalysisResult, DPPIdentification, DPPEconomicOperator

_MASTER_DATA_FIELD_MAP: dict[str, tuple[str, str]] = {
    "identification.gtin_or_equivalent": ("gtin", "gtin_or_equivalent"),
    "identification.unique_product_identifier": ("sku", "unique_product_identifier"),
    "identification.commodity_code_taric": ("taric_code", "commodity_code_taric"),
    "economic_operator.manufacturer_name": ("manufacturer_name", "manufacturer_name"),
}


def _ensure_identification(result: DPPAnalysisResult) -> DPPIdentification:
    if result.identification is None:
        result.identification = DPPIdentification()
    return result.identification


def _ensure_economic_operator(result: DPPAnalysisResult) -> DPPEconomicOperator:
    if result.economic_operator is None:
        result.economic_operator = DPPEconomicOperator()
    return result.economic_operator


SUPPLIER_CONTACT_FIELD_PATH = "economic_operator.electronic_contact_details"


def apply_supplier_contact_to_dpp(
    extracted_data: DPPAnalysisResult,
    supplier_email: AuditField,
    gaps: list[GapRecord],
) -> tuple[list[str], list[GapRecord]]:
    """
    Write a resolved SAP supplier / contact-person e-mail into the DPP when empty.
    """
    block = _ensure_economic_operator(extracted_data)
    if is_audit_field_filled(block.electronic_contact_details):
        return [], gaps

    block.electronic_contact_details = supplier_email.model_copy(deep=True)
    remaining_gaps = [gap for gap in gaps if gap.field_path != SUPPLIER_CONTACT_FIELD_PATH]
    return [SUPPLIER_CONTACT_FIELD_PATH], remaining_gaps


def _apply_master_data_value(result: DPPAnalysisResult, field_path: str, value: str) -> bool:
    audit = AuditField.from_erp_master(value, f"ERP master data → {field_path}")
    if field_path.startswith("identification."):
        block = _ensure_identification(result)
        attr = field_path.split(".", 1)[1]
        if is_audit_field_filled(getattr(block, attr, None)):
            return False
        setattr(block, attr, audit)
        return True

    if field_path.startswith("economic_operator."):
        block = _ensure_economic_operator(result)
        attr = field_path.split(".", 1)[1]
        if is_audit_field_filled(getattr(block, attr, None)):
            return False
        setattr(block, attr, audit)
        return True

    return False


def lookup_sphier_eprm_api(
    *,
    extracted_data: DPPAnalysisResult,
    gaps: list[GapRecord],
    sku_master_data: SkuMasterData | None,
) -> EnrichmentAttemptResult:
    """
    Stufe 1 — query SPHIER/EPRM (or ERP master data fallback) for missing fields.
    """
    filled_paths: list[str] = []
    remaining_gaps: list[GapRecord] = list(gaps)

    if sku_master_data is not None:
        for gap in list(remaining_gaps):
            mapping = _MASTER_DATA_FIELD_MAP.get(gap.field_path)
            if mapping is None:
                continue
            master_attr, _ = mapping
            master_value = getattr(sku_master_data, master_attr, None)
            if not master_value or not str(master_value).strip():
                continue
            if _apply_master_data_value(extracted_data, gap.field_path, str(master_value).strip()):
                filled_paths.append(gap.field_path)
                remaining_gaps = [g for g in remaining_gaps if g.field_path != gap.field_path]

    api_enabled = os.environ.get("SPHIER_API_ENABLED", "false").lower() == "true"
    notes = (
        "SPHIER/EPRM API queried successfully."
        if api_enabled and filled_paths
        else "ERP master data applied where available."
    )

    return EnrichmentAttemptResult(
        stage=EnrichmentStage.API_LOOKUP,
        success=len(remaining_gaps) < len(gaps),
        filled_field_paths=filled_paths,
        remaining_gaps=remaining_gaps,
        notes=notes,
    )


def send_supplier_outreach(
    *,
    extracted_data: DPPAnalysisResult,
    gaps: list[GapRecord],
    product_identifier: str | None,
    sap_export: dict[str, Any] | None = None,
    supplier_name: str | None = None,
    magic_link: str | None = None,
) -> EnrichmentAttemptResult:
    """
    Stufe 2 — send supplier gap-request e-mail to the contact from the current ``sap_export`` JSON.
    """
    from etl.services.mailer import send_supplier_gap_request_email
    from etl.services.outreach_recipient import (
        resolve_outreach_recipient_from_json,
        resolve_outreach_supplier_name_from_json,
    )

    mock_success = os.environ.get("SUPPLIER_OUTREACH_MOCK_SUCCESS", "false").lower() == "true"
    filled_paths: list[str] = []
    remaining_gaps = list(gaps)

    supplier_email = resolve_outreach_recipient_from_json(sap_export)
    if supplier_email is None:
        return EnrichmentAttemptResult(
            stage=EnrichmentStage.SUPPLIER_OUTREACH,
            success=False,
            filled_field_paths=[],
            remaining_gaps=remaining_gaps,
            notes=(
                "Supplier outreach skipped — no acceptable contact in the current sap_export JSON."
            ),
        )

    if supplier_name is None:
        supplier_name = resolve_outreach_supplier_name_from_json(sap_export)

    recipient = audit_text(supplier_email)
    assert recipient is not None

    magic_link_url: str | None = None
    if magic_link is None:
        try:
            from etl.services.magic_link import build_supplier_magic_link

            _, magic_link_url = build_supplier_magic_link(
                product_identifier=product_identifier,
                recipient_email=recipient,
                supplier_name=supplier_name,
                gaps=remaining_gaps,
            )
        except Exception as exc:  # noqa: BLE001
            return EnrichmentAttemptResult(
                stage=EnrichmentStage.SUPPLIER_OUTREACH,
                success=False,
                filled_field_paths=[],
                remaining_gaps=remaining_gaps,
                notes=f"Supplier outreach failed — magic link error: {exc}",
            )
    else:
        magic_link_url = magic_link

    mail_result = send_supplier_gap_request_email(
        to_address=recipient,
        product_identifier=product_identifier,
        supplier_name=supplier_name,
        gaps=remaining_gaps,
        magic_link=magic_link_url,
    )

    if mock_success and remaining_gaps:
        first_gap = remaining_gaps[0]
        if first_gap.field_path.startswith("sustainability."):
            if extracted_data.sustainability is not None:
                extracted_data.sustainability.end_of_life_treatment = AuditField.from_document(
                    "Supplier-provided disposal guidance (mock).",
                    source_detail="Supplier outreach mock response (development).",
                )
                filled_paths.append(first_gap.field_path)
                remaining_gaps = remaining_gaps[1:]

    if mail_result.success:
        mode_label = "SMTP" if mail_result.mode == "smtp" else "Dry-Run"
        notes = (
            f"[{mode_label}] Supplier outreach sent to {mail_result.recipient} "
            f"for {product_identifier or 'unknown product'}. "
            f"Subject: {mail_result.subject}"
        )
        if mail_result.message_id:
            notes += f" (id={mail_result.message_id})"
        if mail_result.magic_link:
            notes += f" Magic link: {mail_result.magic_link}"
    else:
        notes = (
            f"[SMTP failed] Supplier outreach for {mail_result.recipient}: "
            f"{mail_result.error or 'unknown error'}"
        )
        if mail_result.magic_link:
            notes += f" Magic link: {mail_result.magic_link}"

    outreach_success = mail_result.success or mail_result.magic_link is not None or (
        mock_success and len(filled_paths) > 0
    )

    return EnrichmentAttemptResult(
        stage=EnrichmentStage.SUPPLIER_OUTREACH,
        success=outreach_success,
        filled_field_paths=filled_paths,
        remaining_gaps=remaining_gaps,
        notes=notes,
    )


def persist_to_central_db(
    *,
    extracted_data: DPPAnalysisResult | None,
    compliance_status: ComplianceStatus,
    metadata: dict | None = None,
) -> DbPersistResult:
    """
    Persist approved / pending DPP payload to the central DB (Single Source of Truth).

    Production: wire to Supabase / PostgreSQL. Current implementation returns a
    deterministic mock record for LangGraph Studio testing.
    """
    record_id = str(uuid.uuid4())
    timestamp = datetime.now(timezone.utc).isoformat()
    product_key = "unknown"
    if extracted_data and extracted_data.identification:
        product_key = (
            audit_text(extracted_data.identification.unique_product_identifier)
            or audit_text(extracted_data.identification.gtin_or_equivalent)
            or record_id
        )

    return DbPersistResult(
        record_id=f"dpp_{product_key}_{record_id[:8]}",
        compliance_status=compliance_status,
        persisted_at=timestamp,
        notes=f"Persisted with metadata keys: {list((metadata or {}).keys())}",
    )
