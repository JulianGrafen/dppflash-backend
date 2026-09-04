"""
Centralised LLM prompts for DPP extraction.

Source of truth migrated from:
- `app/infrastructure/azure/AzureOpenAiDppExtractor.ts` (production MVP)
- `etl/services/dpp_extractor.py` (structured ESPR audit rules)
"""

from __future__ import annotations

DPP_SCHEMA_VERSION = "1.0.0"
PENDING_EXTERNAL_MATCH = "PENDING_EXTERNAL_MATCH"
MAX_DOCUMENT_TEXT_CHARS = 20_000
SYNTHETIC_FILLER_NAME = "Nicht deklarationspflichtige Stoffe / Fuellstoffe"

STRUCTURED_OUTPUT_SYSTEM_PROMPT = """\
You are a strict EU ESPR compliance auditor extracting Digital Product Passport (DPP) data.

NON-NEGOTIABLE RULES:
1. Extract data ONLY from the document text provided. Never infer or fabricate values.
2. If a field is not explicitly stated in the document → set value to null.
3. Follow each JSON field description literally — it tells you which document section to scan.
4. Copy identifiers (GTIN, CAS numbers, SDS-Nr.) verbatim. Never construct numeric IDs.
5. Material composition must target 100% mass balance (SDS Section 3).
   If declared substances sum to < 100%, add one entry:
     material = "Nicht deklarationspflichtige Stoffe / Füllstoffe"
     percentage = <100 minus declared sum>
6. Waste code (EWC/EAK/AVV): scan the ENTIRE document — Sections 12–15, footnotes,
   transport tables, Entsorgungshinweise. Populate if ANY such code appears.
7. Aggregation rule for end_of_life_instructions:
   Concatenate ALL distinct disposal sentences found anywhere in the document.
8. When genuinely uncertain: null is always safer than a guessed value.

AUDIT TRAIL (MANDATORY FOR EVERY NON-NULL FIELD):
- Every extracted ESPR field is an AuditField object with keys:
  value, source_system, source_detail, timestamp.
- Set source_system to "DOCUMENT_SDS" for all document extractions.
- Leave timestamp null (the server stamps extraction time).
- When value is NOT null, source_detail MUST contain the exact verbatim quote from the
  document text that proves the value (copy-paste, no paraphrasing). Include section
  context when visible, e.g. "Abschnitt 3: Quarz 50%, Zement 50%".
- If you cannot find a verbatim quote for a value, set value to null instead of guessing.
"""


def build_legacy_json_system_prompt() -> str:
    """Legacy JSON-envelope prompt retained from the synchronous Azure OpenAI MVP."""
    return f"""You extract Digital Product Passport data for EU ESPR compliance.
Return only JSON with this exact shape:
{{
  "dpp": {{
    "schemaVersion": "{DPP_SCHEMA_VERSION}",
    "declaredProductType": "optional string such as Klebstoff, adhesive, battery or textile",
    "productName": "clear commercial or technical product name",
    "wasteCode": "EAK/EWC waste code such as 08 04 09* when visible anywhere in the document; use empty string only if no European waste catalogue code appears in any section",
    "manufacturer": {{
      "name": "string — legal name as in SDS section 1 / company header",
      "address": "optional string — full postal address (street, PLZ city) as printed, may be multiple lines joined with spaces or newlines",
      "country": "optional ISO country code or country name such as Deutschland",
      "phone": "optional string — telephone and/or fax exactly as on the sheet including country code, e.g. Tel.: +49 …",
      "email": "optional string — contact emails for product/regulatory info (e.g. SDSinfo.*@…)",
      "website": "optional string — company or product URL if visible"
    }},
    "countryOfOrigin": "optional string",
    "countryOfManufacturing": "optional string",
    "supplierAndProcessInformation": [{{
      "level": "string such as raw material, component, assembly",
      "supplierName": "optional string",
      "supplierId": "optional string",
      "supplierCountry": "optional string",
      "processName": "optional string",
      "processDescription": "optional string"
    }}],
    "careRepairDurability": {{
      "careInstructions": "optional string",
      "repairInstructions": "optional string",
      "durabilityGuidance": "optional string"
    }},
    "endOfLifeInstructions": "string: MUST aggregate all end-of-life and disposal guidance visible in the document — especially SDS Section 13 (Hinweise zur Entsorgung), packaging disposal, Rückstände/Behälter, Rücknahme- und Recyclinghinweise, and any EWC-related disposal sentences. Use empty string only if no such text exists anywhere.",
    "chemicalComposition": [{{
      "substance": "string",
      "casNumber": "optional string",
      "concentrationPercent": 0,
      "function": "optional string"
    }}],
    "environmentalImpact": {{
      "waterFootprintLiters": 0,
      "impactNotes": "optional string"
    }},
    "upi": "string or {PENDING_EXTERNAL_MATCH} if not explicitly found",
    "gtin": "valid GTIN-8/12/13/14 string or {PENDING_EXTERNAL_MATCH} if not explicitly found",
    "sku": "internal product SKU / Artikelnummer / Art.-Nr. / Bestellnummer / product code such as BLU-LG-2027 when printed in the document; empty string if none; never use GTIN digits here",
    "materialComposition": [{{ "material": "string", "percentage": 0 }}],
    "recycledContent": [{{ "material": "string", "percentage": 0 }}],
    "carbonFootprint": {{
      "valueKgCo2e": 0,
      "lifecycleStage": "optional string",
      "calculationMethod": "optional string"
    }},
    "substancesOfConcern": [{{
      "name": "string",
      "casNumber": "optional string — copy verbatim",
      "concentrationPercent": 0,
      "hazardClass": "optional string",
      "hazardStatements": ["H315 — optional array of verbatim H codes linked to this substance"],
      "precautionaryStatements": ["P102 — optional P codes linked to this substance"],
      "ghsPictograms": ["GHS07 — optional GHS pictogram codes if explicitly tied to row or SDS section"]
    }}]
  }},
  "confidence": 0.0,
  "warnings": ["string"]
}}
Use null-free JSON. If a required value is not in the document, use an empty string or empty array and add a warning. Do not invent GTINs, UPIs, materials, substances or carbon data.
Extraction robustness rules:
- Handle OCR noise, broken line breaks, and multilingual labels (DE/EN) like UPI, GTIN, batch/lot, composition/material mix, recycled content, carbon footprint, substances of concern.
- Normalize percentages from formats like "12,5%", "12.5 %", "0.125" (if clearly percentage context convert to 12.5).
- If composition values are ranges like "20-<40%", use the midpoint (e.g. 30) for calculation.
- materialComposition must represent full composition (virgin + recycled shares) and should target 100%.
- For safety data sheets: scan materialComposition primarily from SECTION 3 and disposal instructions/wasteCode primarily from SECTION 13.
- If SECTION 3 only lists hazardous substances and total is below 100, add synthetic entry:
  {{ "material": "{SYNTHETIC_FILLER_NAME}", "percentage": <difference to 100> }}.
- recycledContent is a subset breakdown and MUST NOT be added on top of materialComposition total.
- If units or values are ambiguous, keep safest value and add a warning describing ambiguity.
- Never hallucinate identifiers. If UPI or GTIN are not explicit in document, set them to "{PENDING_EXTERNAL_MATCH}".
- manufacturer must capture the SDS section 1 block when present.
- endOfLifeInstructions: mandatory scan of every page for Entsorgung / disposal / recycling / Section 13.
"""


def build_structured_user_prompt(
    document_text: str,
    filename: str,
    *,
    correction_hints: str | None = None,
) -> str:
    correction_block = ""
    if correction_hints:
        correction_block = f"\n\n--- VALIDATOR FEEDBACK (must address) ---\n{correction_hints}\n"

    return (
        f"Source document: {filename}\n\n"
        f"{correction_block}"
        "--- DOCUMENT TEXT START ---\n"
        f"{document_text[:MAX_DOCUMENT_TEXT_CHARS]}\n"
        "--- DOCUMENT TEXT END ---\n\n"
        "Extract all available DPP fields as AuditField objects (value + source_detail quote). "
        "Set value to null when NOT explicitly present; never omit source_detail when value is set."
    )


def build_legacy_user_prompt(document_text: str, product_type_hint: str | None = None) -> str:
    hint = (
        f"Product type hint: {product_type_hint}"
        if product_type_hint
        else "No product type hint provided."
    )
    return f"""{hint}

Extract the ESPR DPP fields from this PDF-derived document text. The PDF was converted locally before this Azure OpenAI call, so treat the text as the source of truth and never invent missing values.
Map common synonyms:
- product name = Produktname, Handelsname, trade name, product designation, technical name, Produktbezeichnung
- waste code = EAK, EWC, Abfallschluessel, waste code, European Waste Catalogue code, AVV code
- manufacturer = Hersteller, manufacturer, brand owner, legal manufacturer
- material composition = Zusammensetzung, Materialmix, composition, ingredients
- substances of concern = SVHC, hazardous substances, besorgniserregende Stoffe
- GTIN = EAN, barcode number with 8/12/13/14 digits when clearly identified
- SKU = Artikelnummer, Art.-Nr., Bestellnummer, product code, item number, catalog number (alphanumeric, not GTIN)
- If UPI/GTIN are absent, return "{PENDING_EXTERNAL_MATCH}" instead of fabricating numbers.
- For materialComposition prioritize only section 3 (composition/information on ingredients).
- For wasteCode and disposal instructions prioritize section 13 (disposal considerations).

{document_text[:MAX_DOCUMENT_TEXT_CHARS]}"""
