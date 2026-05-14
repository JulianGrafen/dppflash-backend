import type { ComplianceLlmPort } from '@/app/application/ports/rag/ComplianceLlmPort';
import type { ExtractedAttributeRow } from '@/app/domain/rag/extractedAttributesJson';
import {
  eagerExtractionResponseSchema,
  eagerExtractionResponseToRows,
} from '@/app/domain/rag/eagerExtractionResponseSchema';

const MAX_DOCUMENT_CHARS = 120_000;

const EAGER_FIELD_KEYS_JSON = JSON.stringify([
  'hersteller',
  'modellname',
  'ewcCode',
  'wasteCode',
  'countryOfOrigin',
  'countryOfManufacturing',
  'endOfLifeInstructions',
  'chemicalComposition',
  'gtin',
]);

const SYSTEM = `Du bist ein Daten-Extraktor für technische Produktunterlagen (ESPR / Digital Product Passport).
Du erhältst den Volltext eines PDFs (mit Seiten-Markern). Extrahiere **nur** Informationen, die wörtlich oder eindeutig im Text stehen. Erfinde nichts.

Antworte mit **genau einem JSON-Objekt** (ohne Markdown). Top-Level-Keys sind **ausschließlich** die vorgegebene Liste.

Verwende AUSSCHLIESSLICH diese englischen/technischen Keys. Übersetze die Keys nicht ins Deutsche! Wenn ein Feld nicht im Text steht, lass es komplett weg — füge **keinen** Key mit leerem String oder null als Platzhalter ein.

WICHTIG: chemische Zusammensetzung / Materialien → Key 'chemicalComposition'. Entsorgung / End-of-Life → 'endOfLifeInstructions'. Produktbezeichnung / Name → 'modellname'.

Jeder vorhandene Key mappt zu genau diesem Objekt (keine weiteren Property-Namen):
{
  "value": string | null,
  "sourcePdf": string (Dateiname der Quelle, wie übergeben),
  "contextSnippet": string (kurzes wörtliches Zitat aus dem Text als Beleg)
}

Regeln:
- Numerische Kennwerte als String in "value".
- GTIN nur als Ziffernfolge aus dem Text.
- EWC/Abfallschlüssel nur bei plausibler Kennzeichnung.`;

export interface BackgroundExtractionInput {
  readonly documentText: string;
  readonly fileName: string;
  readonly productNameHint: string;
}

/**
 * Eager extraction during PDF ingest: ein LLM-Lauf über den Dokumenttext → strukturierte Kandidaten
 * für `products.extracted_attributes` (sicherer Value-Merge in {@link ProductEntityService.mergeExtractedAttributes}).
 */
export class BackgroundExtractionAgent {
  constructor(private readonly llm: ComplianceLlmPort) {}

  async extractFromDocumentText(input: BackgroundExtractionInput): Promise<Record<string, ExtractedAttributeRow>> {
    const body = input.documentText.slice(0, MAX_DOCUMENT_CHARS);

    const user = `Erlaubte Top-Level-Feld-Keys (exakt, camelCase, keine anderen Keys): ${EAGER_FIELD_KEYS_JSON}

Quelldatei (sourcePdf in jeder Antwort verwenden): ${input.fileName}
Produktname-Hinweis (Kontext): ${input.productNameHint}

Dokumenttext:
${body}`;

    const raw = await this.llm.completeJson(SYSTEM, user);

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      console.warn('[EAGER] JSON.parse failed on LLM response');
      return {};
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      console.warn('[EAGER] LLM response is not a JSON object');
      return {};
    }

    const validated = eagerExtractionResponseSchema.safeParse(parsed);
    if (!validated.success) {
      console.warn('[EAGER] Zod validation failed (strict keys only):', validated.error.flatten());
      return {};
    }

    return eagerExtractionResponseToRows(validated.data, input.fileName);
  }
}
