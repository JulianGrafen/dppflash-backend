#!/usr/bin/env python3
"""
Demonstrate end-to-end audit trail for DPP extraction.

Runs a simulated SDS document through the structured extractor output path
(without calling OpenAI) and prints the nested AuditField JSON for
``sustainability.material_composition`` plus derived mass-balance metadata.
"""

from __future__ import annotations

import json
import sys

from etl.models.audit_field import AuditField, SourceSystem, audit_text
from etl.models.dpp_schemas import (
    DPPExtractionOutput,
    DPPIdentification,
    ExtractProductDetails,
    ExtractSustainability,
    ProductCategory,
)
from etl.services.validation import validate_extracted_data

SAMPLE_DOCUMENT = """
Sicherheitsdatenblatt — Industrieklebstoff X99
Hersteller: Henkel Experimental GmbH
Abschnitt 3 — Zusammensetzung:
Polyurethane Resin (Binder) 62%, Calciumcarbonat 38%
""".strip()

COMPOSITION_QUOTE = "Polyurethane Resin (Binder) 62%, Calciumcarbonat 38%"


def build_simulated_extraction() -> DPPExtractionOutput:
    """Simulate LLM structured output with mandatory AuditField provenance."""
    return DPPExtractionOutput(
        product_category=ProductCategory.GENERIC,
        identification=DPPIdentification(
            unique_product_identifier=AuditField.from_document(
                "HENK-X99-PROD",
                source_detail="Artikelnummer (MATNR): HENK-X99-PROD",
            ),
        ),
        product_details=ExtractProductDetails(
            contains_svhc=AuditField.from_document(
                False,
                source_detail="Kein SVHC-Hinweis in Abschnitt 3 gefunden.",
            ),
        ),
        sustainability=ExtractSustainability(
            material_composition=AuditField.from_document(
                "Polyurethane Resin (Binder) 62%, Calciumcarbonat 38%",
                source_detail=f"Abschnitt 3 — Zusammensetzung: {COMPOSITION_QUOTE}",
            ),
        ),
    )


def main() -> int:
    llm_output = build_simulated_extraction()
    result = llm_output.to_analysis_result()
    validation = validate_extracted_data(result)

    composition_audit = result.get_audit_field("sustainability.material_composition")
    if composition_audit is None:
        print("ERROR: material_composition audit field missing", file=sys.stderr)
        return 1

    mass_balance_pct = validation.report.mass_balance_total_percent
    mass_balance_audit = AuditField.from_inference(
        mass_balance_pct,
        source_detail=(
            f"Derived from audited composition quote: {audit_text(composition_audit)!r} "
            f"(sum={mass_balance_pct}%)"
        ),
    )

    payload = {
        "document_excerpt": SAMPLE_DOCUMENT,
        "sustainability.material_composition": composition_audit.model_dump(mode="json"),
        "mass_balance_pct": mass_balance_audit.model_dump(mode="json"),
        "mass_balance_ok": validation.report.mass_balance_ok,
        "validation_status": validation.report.status.value,
    }

    print(json.dumps(payload, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
