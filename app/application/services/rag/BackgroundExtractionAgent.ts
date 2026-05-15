import type { ComplianceLlmPort } from '@/app/application/ports/rag/ComplianceLlmPort';
import type { ExtractedAttributeRow } from '@/app/domain/rag/extractedAttributesJson';
import {
  EAGER_CANONICAL_FIELD_KEYS,
  eagerExtractionResponseSchema,
  eagerExtractionResponseToRows,
  normalizeEagerExtractionRawObject,
} from '@/app/domain/rag/eagerExtractionResponseSchema';

const MAX_DOCUMENT_CHARS = 120_000;

const EAGER_FIELD_KEYS_JSON = JSON.stringify([...EAGER_CANONICAL_FIELD_KEYS]);

const SYSTEM = `Du bist ein Daten-Extraktor für technische Produktunterlagen (ESPR / Digital Product Passport).
Du erhältst den Volltext eines PDFs (mit Seiten-Markern). Extrahiere **nur** Informationen, die wörtlich oder eindeutig im Text stehen. Erfinde nichts.

Antworte mit **genau einem JSON-Objekt** (ohne Markdown). Top-Level-Keys sind **ausschließlich** die vorgegebene Liste.

Extrahiere die Daten STRENG nach diesem Schema. Nutze niemals deutsche Keys!

- Zusammensetzung / Materialien / Rezeptur aus Abschnitt 3 eines Sicherheitsdatenblatts → chemicalComposition (NICHT materialZusammensetzung, NICHT materialComposition). **Spezialfall chemicalComposition:** siehe unten.
- Entsorgung / End-of-Life / Abschnitt 13 → endOfLifeInstructions
- Hersteller / Lieferant / Inverkehrbringer → hersteller (NICHT manufacturer, NICHT Hersteller)
- Handelsname / Produktbezeichnung auf dem Deckblatt → productName (NICHT produktname)
- Modell / Typenbezeichnung → modellname
- Abfallschlüssel / EWC / EAK / AVV → ewcCode
- GTIN / EAN / Barcode → gtin

WICHTIG: Wenn du die chemische Zusammensetzung aus Abschnitt 3 eines Sicherheitsdatenblatts extrahierst, musst du JEDEN Stoff als einzelnes Objekt in das Array "chemicalComposition.value" packen. Du darfst keine Stoffe weglassen. Die Prozentangaben (Konzentration) müssen zwingend übernommen werden!

**chemicalComposition** (falls vorhanden) mappt zu genau diesem Objekt — value ist ein **Array von Objekten** (nicht kommagetrennter Text):
{
  "value": [
    {
      "stoffname": string,
      "casNummer": string | null,
      "prozentAnteil": string,
      "einstufung": string | null
    }
  ] | null,
  "sourcePdf": string (Dateiname der Quelle, wie übergeben),
  "contextSnippet": string (kurzes wörtliches Zitat aus dem Text als Beleg)
}

Alle **anderen** Felder mappen zu genau diesem Objekt (keine weiteren Property-Namen):
{
  "value": string | null,
  "sourcePdf": string (Dateiname der Quelle, wie übergeben),
  "contextSnippet": string (kurzes wörtliches Zitat aus dem Text als Beleg)
}

Regeln:
- Numerische Kennwerte (außer chemicalComposition) als String in "value".
- GTIN nur als Ziffernfolge aus dem Text.
- EWC/Abfallschlüssel nur bei plausibler Kennzeichnung.
- chemicalComposition.value ist ein nicht-leeres Array von Stoff-Zeilen — nie ein einzelner Freitext über alle Stoffe.

Wenn ein Feld nicht im Text steht oder nicht extrahierbar ist, lasse den Top-Level-Key weg — keine Platzhalter mit leeren Strings.
chemicalComposition nur ausgeben, wenn du ein nicht-leeres Array von Stoff-Objekten hast (keine zusammengefasste Kommaliste als Freitext).`;

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

    const normalized = normalizeEagerExtractionRawObject(parsed as Record<string, unknown>);
    const validated = eagerExtractionResponseSchema.safeParse(normalized);
    if (!validated.success) {
      console.warn('[EAGER] Zod validation failed (strict keys only):', validated.error.flatten());
      return {};
    }

    return eagerExtractionResponseToRows(validated.data, input.fileName);
  }
}
