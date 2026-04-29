import { DPP_SCHEMA_VERSION, type DppProductPassport } from '@/app/domain/dpp/dppSchema';
import type {
  SemanticDppExtractionInput,
  SemanticDppExtractionPort,
  SemanticDppExtractionResult,
} from '@/app/application/ports/SemanticDppExtractionPort';
import type { SafeLoggerPort } from '@/app/application/ports/SafeLoggerPort';
import type { AzureOpenAiConfig } from '@/app/infrastructure/azure/azureConfig';
import { renderPdfPagesAsImages } from '@/app/utils/pdfPageImages';
import { readPdf } from '@/app/utils/pdfReader';

interface AzureOpenAiChatResponse {
  readonly choices?: readonly {
    readonly message?: {
      readonly content?: string;
    };
  }[];
}

interface DppExtractionEnvelope {
  readonly dpp: DppProductPassport;
  readonly confidence?: number;
  readonly warnings?: readonly string[];
}

type AzureOpenAiUserContentPart =
  | {
      readonly type: 'text';
      readonly text: string;
    }
  | {
      readonly type: 'image_url';
      readonly image_url: {
        readonly url: string;
        readonly detail: 'high';
      };
    };

const MAX_DOCUMENT_TEXT_CHARS = 20_000;
const MAX_ERROR_BODY_CHARS = 700;
const COMPOSITION_TARGET_PERCENT = 100;
const COMPOSITION_TOLERANCE = 0.01;
const PENDING_EXTERNAL_MATCH = 'PENDING_EXTERNAL_MATCH';
const SYNTHETIC_FILLER_NAME = 'Nicht deklarationspflichtige Stoffe / Fuellstoffe';
let hasLoggedAzureOpenAiUrl = false;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseExtractionEnvelope(content: string): DppExtractionEnvelope {
  const parsed = JSON.parse(content) as unknown;

  if (!isRecord(parsed) || !isRecord(parsed.dpp)) {
    throw new Error('Azure OpenAI response does not match the DPP extraction envelope.');
  }

  return parsed as unknown as DppExtractionEnvelope;
}

function parsePercentageLike(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const compact = value.replace(/\s+/g, '').replace(',', '.');
  const explicitRange = compact.match(/^(-?\d+(?:\.\d+)?)-<?(-?\d+(?:\.\d+)?)%?$/);

  if (explicitRange) {
    const lower = Number(explicitRange[1]);
    const upper = Number(explicitRange[2]);
    if (Number.isFinite(lower) && Number.isFinite(upper)) {
      return (lower + upper) / 2;
    }
  }

  const normalized = compact.endsWith('%') ? compact.slice(0, -1) : compact;
  const direct = Number(normalized);

  if (!Number.isFinite(direct)) {
    return undefined;
  }

  return direct;
}

function normalizeMaterialComposition(
  dpp: DppProductPassport,
): { readonly dpp: DppProductPassport; readonly warnings: readonly string[] } {
  const normalizedMaterials = dpp.materialComposition.map((entry) => {
    const normalizedPercentage = parsePercentageLike(entry.percentage);
    return {
      ...entry,
      percentage: normalizedPercentage ?? entry.percentage,
    };
  });

  const total = normalizedMaterials.reduce((sum, material) => sum + material.percentage, 0);
  const missingShare = COMPOSITION_TARGET_PERCENT - total;

  if (missingShare <= COMPOSITION_TOLERANCE) {
    return {
      dpp: {
        ...dpp,
        materialComposition: normalizedMaterials,
      },
      warnings: [],
    };
  }

  return {
    dpp: {
      ...dpp,
      materialComposition: [
        ...normalizedMaterials,
        {
          material: SYNTHETIC_FILLER_NAME,
          percentage: Number(missingShare.toFixed(2)),
        },
      ],
    },
    warnings: [
      `materialComposition: Added synthetic filler entry "${SYNTHETIC_FILLER_NAME}" with ${missingShare.toFixed(2)}% to close mass balance for partially declared SDB composition.`,
    ],
  };
}

function normalizeIdentifiers(dpp: DppProductPassport): {
  readonly dpp: DppProductPassport;
  readonly warnings: readonly string[];
} {
  const warnings: string[] = [];
  const upi = dpp.upi?.trim() ? dpp.upi : PENDING_EXTERNAL_MATCH;
  const gtin = dpp.gtin?.trim() ? dpp.gtin : PENDING_EXTERNAL_MATCH;

  if (upi === PENDING_EXTERNAL_MATCH) {
    warnings.push('upi: Not explicitly found in document. Set to PENDING_EXTERNAL_MATCH.');
  }

  if (gtin === PENDING_EXTERNAL_MATCH) {
    warnings.push('gtin: Not explicitly found in document. Set to PENDING_EXTERNAL_MATCH.');
  }

  return {
    dpp: {
      ...dpp,
      upi,
      gtin,
    },
    warnings,
  };
}

function normalizeExtractedDpp(dpp: DppProductPassport): {
  readonly dpp: DppProductPassport;
  readonly warnings: readonly string[];
} {
  const normalizedIdentifiers = normalizeIdentifiers(dpp);
  const normalizedComposition = normalizeMaterialComposition(normalizedIdentifiers.dpp);

  return {
    dpp: normalizedComposition.dpp,
    warnings: [...normalizedIdentifiers.warnings, ...normalizedComposition.warnings],
  };
}

function buildSystemPrompt(): string {
  return `You extract Digital Product Passport data for EU ESPR compliance.
Return only JSON with this exact shape:
{
  "dpp": {
    "schemaVersion": "${DPP_SCHEMA_VERSION}",
    "declaredProductType": "optional string such as Klebstoff, adhesive, battery or textile",
    "productName": "clear commercial or technical product name",
    "wasteCode": "optional EAK/EWC waste code such as 08 04 09*",
    "manufacturer": {
      "name": "string",
      "address": "optional string",
      "country": "optional ISO country code or country name"
    },
    "countryOfOrigin": "optional string",
    "countryOfManufacturing": "optional string",
    "supplierAndProcessInformation": [{
      "level": "string such as raw material, component, assembly",
      "supplierName": "optional string",
      "supplierId": "optional string",
      "supplierCountry": "optional string",
      "processName": "optional string",
      "processDescription": "optional string"
    }],
    "careRepairDurability": {
      "careInstructions": "optional string",
      "repairInstructions": "optional string",
      "durabilityGuidance": "optional string"
    },
    "endOfLifeInstructions": "optional string",
    "chemicalComposition": [{
      "substance": "string",
      "casNumber": "optional string",
      "concentrationPercent": 0,
      "function": "optional string"
    }],
    "environmentalImpact": {
      "waterFootprintLiters": 0,
      "impactNotes": "optional string"
    },
    "upi": "string or PENDING_EXTERNAL_MATCH if not explicitly found",
    "gtin": "valid GTIN-8/12/13/14 string or PENDING_EXTERNAL_MATCH if not explicitly found",
    "materialComposition": [{ "material": "string", "percentage": 0 }],
    "recycledContent": [{ "material": "string", "percentage": 0 }],
    "carbonFootprint": {
      "valueKgCo2e": 0,
      "lifecycleStage": "optional string",
      "calculationMethod": "optional string"
    },
    "substancesOfConcern": [{
      "name": "string",
      "casNumber": "optional string",
      "concentrationPercent": 0,
      "hazardClass": "optional string"
    }]
  },
  "confidence": 0.0,
  "warnings": ["string"]
}
Use null-free JSON. If a required value is not in the document, use an empty string or empty array and add a warning. Do not invent GTINs, UPIs, materials, substances or carbon data.
Extraction robustness rules:
- Handle OCR noise, broken line breaks, and multilingual labels (DE/EN) like UPI, GTIN, batch/lot, composition/material mix, recycled content, carbon footprint, substances of concern.
- Normalize percentages from formats like "12,5%", "12.5 %", "0.125" (if clearly percentage context convert to 12.5).
- If composition values are ranges like "20-<40%", use the midpoint (e.g. 30) for calculation.
- materialComposition must represent full composition (virgin + recycled shares) and should target 100%.
- For safety data sheets: scan materialComposition primarily from SECTION 3 and disposal instructions/wasteCode primarily from SECTION 13.
- If SECTION 3 only lists hazardous substances and total is below 100, add synthetic entry:
  { "material": "Nicht deklarationspflichtige Stoffe / Fuellstoffe", "percentage": <difference to 100> }.
- recycledContent is a subset breakdown and MUST NOT be added on top of materialComposition total.
- If units or values are ambiguous, keep safest value and add a warning describing ambiguity.
- For adhesives, coatings, chemicals and technical data sheets, prefer extracting named formulation components, fillers, binders, diluents, modifiers, additives and hazardous substances.
- Preserve original business wording of materials and substances where possible.
- If a CAS number is visible for a material or substance, copy it exactly.
- productName should be the best human-readable title of the product sheet, product name, trade name, or model heading visible in the document.
- wasteCode should capture any explicit EAK/EWC waste code or European waste catalogue code shown in disposal, recycling or safety sections.
- Never hallucinate identifiers. If UPI or GTIN are not explicit in document, set them to "${PENDING_EXTERNAL_MATCH}".
- For UPI prioritization, scan the header first for SDB-Nr, Artikelnummer, product code, item number.
- manufacturer should identify the legal manufacturer or brand owner when visible.
- countryOfOrigin and countryOfManufacturing may differ; extract both separately when the document distinguishes them.
- supplierAndProcessInformation should capture supplier/process details only when the document clearly states the level or stage.
- careRepairDurability should summarize care, repair, maintenance, service life or durability guidance in concise business wording.
- chemicalComposition should focus on named chemical substances/components; materialComposition remains the broader product/material mix.
- environmentalImpact should include additional environmental metrics or notes beyond the dedicated carbonFootprint object.

Example target output for an adhesive product sheet:
{
  "dpp": {
    "schemaVersion": "${DPP_SCHEMA_VERSION}",
    "declaredProductType": "Industriekleber",
    "productName": "Industriekleber UltraFix 5000",
    "wasteCode": "08 04 09*",
    "manufacturer": {
      "name": "Henkel",
      "address": "Düsseldorf, Germany",
      "country": "DE"
    },
    "countryOfOrigin": "Germany",
    "countryOfManufacturing": "Germany",
    "supplierAndProcessInformation": [
      {
        "level": "formulation",
        "processName": "Epoxy adhesive mixing",
        "processDescription": "Two-component epoxy formulation and filling"
      }
    ],
    "careRepairDurability": {
      "careInstructions": "Store cool and dry. Protect from moisture.",
      "repairInstructions": "Follow technical data sheet curing and surface preparation steps.",
      "durabilityGuidance": "Observe stated shelf life and curing conditions."
    },
    "endOfLifeInstructions": "Dispose cured residues according to local hazardous waste rules.",
    "chemicalComposition": [
      {
        "substance": "Epoxidharz (Bisphenol-A)",
        "casNumber": "25068-38-6",
        "concentrationPercent": 65,
        "function": "binder"
      }
    ],
    "environmentalImpact": {
      "waterFootprintLiters": 0,
      "impactNotes": "No separate water footprint stated in the sheet."
    },
    "upi": "DE-HEN-992834-UF5000-B2",
    "gtin": "4005800012345",
    "materialComposition": [
      { "material": "Epoxidharz (Bisphenol-A)", "percentage": 65 },
      { "material": "Aluminiumoxid (Füllstoff)", "percentage": 25 },
      { "material": "Reaktivverdünner", "percentage": 8.5 },
      { "material": "Modifikatoren/Additive", "percentage": 1.5 }
    ],
    "recycledContent": [
      { "material": "Aluminiumoxid (Füllstoff)", "percentage": 25 }
    ],
    "carbonFootprint": {
      "valueKgCo2e": 0,
      "lifecycleStage": "",
      "calculationMethod": ""
    },
    "substancesOfConcern": [
      {
        "name": "Epoxidharz (Bisphenol-A)",
        "casNumber": "25068-38-6",
        "concentrationPercent": 65,
        "hazardClass": ""
      }
    ]
  },
  "confidence": 0.95,
  "warnings": []
}`;
}

function buildUserPrompt(documentText: string, productTypeHint?: string): string {
  const hint = productTypeHint ? `Product type hint: ${productTypeHint}` : 'No product type hint provided.';

  return `${hint}

Extract the ESPR DPP fields from this PDF-derived document text. The PDF was converted locally before this Azure OpenAI call, so treat the text as the source of truth and never invent missing values.
Map common synonyms:
- product name = Produktname, Handelsname, trade name, product designation, technical name, Produktbezeichnung
- waste code = EAK, EWC, Abfallschluessel, waste code, European Waste Catalogue code, AVV code
- manufacturer = Hersteller, manufacturer, brand owner, legal manufacturer
- country of origin = Ursprungsland, origin, made in, country of origin
- country of manufacturing = Herstellungsland, manufacturing country, produced in, assembled in
- supplier/process information = supplier, Lieferant, process step, manufacturing step, process stage, supply chain level
- care/repair/durability = Pflegehinweise, repair, maintenance, durability, service life, shelf life, care instructions
- end-of-life = disposal, recycling, end of life, Entsorgung, Rücknahme, recycling instructions
- chemical composition = chemische Zusammensetzung, ingredients, formulation, constituents, substances
- environmental impact = Umweltwirkung, environmental impact, water footprint, LCA, environmental notes
- material composition = Zusammensetzung, Materialmix, composition, ingredients
- recycled content = Rezyklatanteil, recycled share, PCR/PIR
- substances of concern = SVHC, hazardous substances, besorgniserregende Stoffe
- carbon footprint = CO2-Fußabdruck, carbon footprint, kg CO2e
- UPI = Unique Product Identifier, Produktkennung, product identifier
- GTIN = EAN, barcode number, Artikelnummer with 8/12/13/14 digits when clearly identified
- For UPI first inspect header labels such as "SDB-Nr", "Artikelnummer", "Produktnummer", "Item No."
- If UPI/GTIN are absent, return "${PENDING_EXTERNAL_MATCH}" instead of fabricating numbers.
- For materialComposition prioritize only section 3 (composition/information on ingredients).
- For wasteCode and disposal instructions prioritize section 13 (disposal considerations).
- adhesives may use terms such as epoxy resin, hardener, filler, reactive diluent, modifier, additive, binder

${documentText.slice(0, MAX_DOCUMENT_TEXT_CHARS)}`;
}

function buildVisionPrompt(productTypeHint?: string): string {
  const hint = productTypeHint ? `Product type hint: ${productTypeHint}` : 'No product type hint provided.';

  return `${hint}

The attached images are rendered pages from a PDF technical data sheet. Read the visible content and extract the ESPR Digital Product Passport fields. Prioritize section 3 for materialComposition and section 13 for disposal and waste code. Handle titles, manufacturer blocks, country-of-origin labels, supplier or process tables, care or repair sections, ingredient lists, composition blocks, hazard sections, barcode/GTIN fields and OCR noise. Do not invent missing values. Return only the required JSON object.`;
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
}

export class AzureOpenAiDppExtractor implements SemanticDppExtractionPort {
  constructor(
    private readonly config: AzureOpenAiConfig,
    private readonly logger: SafeLoggerPort,
  ) {}

  async extract(input: SemanticDppExtractionInput): Promise<SemanticDppExtractionResult> {
    const preparedInput = await this.prepareInput(input);
    const requestUrl = this.chatCompletionsUrl();

    if (!hasLoggedAzureOpenAiUrl) {
      console.info(`[DPP] Azure OpenAI request URL: ${requestUrl}`);
      hasLoggedAzureOpenAiUrl = true;
    }

    this.logger.info('azure_openai_request_started', {
      endpoint: this.config.endpoint,
      deployment: this.config.deploymentName,
      apiVersion: this.config.apiVersion,
      requestMode: Array.isArray(preparedInput.userContent) ? 'vision' : 'text',
      requestUrl,
    });

    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': this.config.apiKey,
      },
      body: JSON.stringify({
        model: this.config.modelName,
        response_format: { type: 'json_object' },
        temperature: 0,
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: preparedInput.userContent },
        ],
      }),
    });

    if (!response.ok) {
      const responseBody = await response.text();
      const requestId = response.headers.get('x-request-id')
        || response.headers.get('apim-request-id')
        || response.headers.get('x-ms-request-id')
        || 'n/a';

      this.logger.error('azure_openai_request_failed', {
        status: response.status,
        statusText: response.statusText,
        deployment: this.config.deploymentName,
        apiVersion: this.config.apiVersion,
        endpoint: this.config.endpoint,
        requestId,
        responseBody: truncate(responseBody, MAX_ERROR_BODY_CHARS),
      });

      throw new Error(
        `Azure OpenAI extraction failed with status ${response.status}. Deployment="${this.config.deploymentName}", apiVersion="${this.config.apiVersion}", requestId="${requestId}". Body: ${truncate(responseBody, MAX_ERROR_BODY_CHARS)}`,
      );
    }

    const payload = (await response.json()) as AzureOpenAiChatResponse;
    const content = payload.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Azure OpenAI returned an empty extraction response.');
    }

    const envelope = parseExtractionEnvelope(content);
    const normalized = normalizeExtractedDpp(envelope.dpp);

    this.logger.info('azure_openai_extraction_completed', {
      confidence: envelope.confidence ?? 0,
      warningCount: (envelope.warnings?.length ?? 0) + normalized.warnings.length,
    });

    return {
      dpp: normalized.dpp,
      confidence: envelope.confidence ?? 0,
      warnings: [...(envelope.warnings ?? []), ...normalized.warnings],
      pageCount: preparedInput.pageCount,
    };
  }

  private async prepareInput(input: SemanticDppExtractionInput): Promise<{
    readonly userContent: string | readonly AzureOpenAiUserContentPart[];
    readonly pageCount: number;
  }> {
    try {
      const pdfContent = await readPdf(input.pdf, input.fileName);

      this.logger.info('pdf_text_prepared_for_azure_openai', {
        fileSizeBytes: input.pdf.byteLength,
        pageCount: pdfContent.pageCount,
        textLength: pdfContent.text.length,
      });

      return {
        userContent: buildUserPrompt(pdfContent.text, input.productTypeHint),
        pageCount: pdfContent.pageCount,
      };
    } catch (error) {
      this.logger.warn('pdf_text_extraction_failed_using_vision_fallback', {
        fileSizeBytes: input.pdf.byteLength,
        reason: error instanceof Error ? error.message : 'unknown',
      });

      const renderedPages = await renderPdfPagesAsImages(input.pdf);

      if (renderedPages.images.length === 0) {
        throw new Error('PDF could not be converted to text or rendered page images.');
      }

      this.logger.info('pdf_images_prepared_for_azure_openai', {
        pageCount: renderedPages.pageCount,
        renderedPageCount: renderedPages.images.length,
      });

      return {
        userContent: [
          { type: 'text', text: buildVisionPrompt(input.productTypeHint) },
          ...renderedPages.images.map((image) => ({
            type: 'image_url' as const,
            image_url: {
              url: image.dataUrl,
              detail: 'high' as const,
            },
          })),
        ],
        pageCount: renderedPages.pageCount,
      };
    }
  }

  private chatCompletionsUrl(): string {
    const deployment = encodeURIComponent(this.config.deploymentName);
    const apiVersion = encodeURIComponent(this.config.apiVersion);
    return `${this.config.endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
  }
}
