import type { ComplianceLlmPort } from '@/app/application/ports/rag/ComplianceLlmPort';
import { getAllRagExtractionFieldKeys } from '@/app/domain/rag/ragPassportFieldTargets';
import type { ExtractedAttributeRow } from '@/app/domain/rag/extractedAttributesJson';
import { parseExtractedAttributesJson } from '@/app/domain/rag/extractedAttributesJson';

const MAX_DOCUMENT_CHARS = 120_000;

const SYSTEM = `Du bist ein Daten-Extraktor für technische Produktunterlagen (ESPR / Digital Product Passport).
Du erhältst den Volltext eines PDFs (mit Seiten-Markern). Extrahiere **nur** Informationen, die wörtlich oder eindeutig im Text stehen. Erfinde nichts.

Antworte mit **genau einem JSON-Objekt** (ohne Markdown). Top-Level-Keys sind **nur** erlaubte camelCase-Feldnamen aus der vorgegebenen Liste — weglassen, wenn kein belastbarer Wert existiert.

Jeder vorhandene Key mappt zu diesem Objekt:
{
  "value": string | null,
  "sourcePdf": string (Dateiname der Quelle, wie übergeben),
  "contextSnippet": string (kurzes wörtliches Zitat aus dem Text als Beleg),
  "pageNumber": number (>=1, Seite wo der Beleg steht; schätzen aus "--- Seite N ---" wenn eindeutig),
  "confidence": number zwischen 0 und 1
}

Regeln:
- Numerische Kennwerte als String in "value".
- GTIN nur als Ziffernfolge aus dem Text.
- EWC/Abfallschlüssel nur bei plausibler Kennzeichnung.
- Bei Unsicherheit: key weglassen oder value=null mit confidence<=0.2.`;

export interface BackgroundExtractionInput {
  readonly documentText: string;
  readonly fileName: string;
  readonly productNameHint: string;
}

/**
 * Eager extraction during PDF ingest: ein LLM-Lauf über den Dokumenttext → strukturierte Kandidaten
 * für `products.extracted_attributes` (Merge per Konfidenz in {@link ProductEntityService.mergeExtractedAttributes}).
 */
export class BackgroundExtractionAgent {
  constructor(private readonly llm: ComplianceLlmPort) {}

  async extractFromDocumentText(input: BackgroundExtractionInput): Promise<Record<string, ExtractedAttributeRow>> {
    const keys = getAllRagExtractionFieldKeys();
    const keysJson = JSON.stringify(keys);
    const body = input.documentText.slice(0, MAX_DOCUMENT_CHARS);

    const user = `Erlaubte Feld-Keys (camelCase): ${keysJson}

Quelldatei (sourcePdf in jeder Antwort verwenden): ${input.fileName}
Produktname-Hinweis (Kontext): ${input.productNameHint}

Dokumenttext:
${body}`;

    const raw = await this.llm.completeJson(SYSTEM, user);

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      return {};
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    const allowed = new Set(keys);
    const filtered: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (allowed.has(k) && v !== null && typeof v === 'object' && !Array.isArray(v)) {
        filtered[k] = {
          ...(v as Record<string, unknown>),
          sourcePdf:
            typeof (v as Record<string, unknown>).sourcePdf === 'string' &&
            (v as Record<string, unknown>).sourcePdf
              ? (v as Record<string, unknown>).sourcePdf
              : input.fileName,
        };
      }
    }

    return parseExtractedAttributesJson(filtered);
  }
}
