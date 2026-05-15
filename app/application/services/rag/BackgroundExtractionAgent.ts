import type { ComplianceLlmPort } from '@/app/application/ports/rag/ComplianceLlmPort';
import type { ExtractedAttributeRow } from '@/app/domain/rag/extractedAttributesJson';
import {
  EAGER_CANONICAL_FIELD_KEYS,
  eagerExtractionResponseSchema,
  eagerExtractionResponseToRows,
  normalizeEagerExtractionRawObject,
} from '@/app/domain/rag/eagerExtractionResponseSchema';
import {
  isSdsCompositionMassSumPlausible,
  sumApproximateMassPercents,
} from '@/app/domain/rag/sdsCompositionSchema';

const MAX_DOCUMENT_CHARS = 120_000;

const EAGER_FIELD_KEYS_JSON = JSON.stringify([...EAGER_CANONICAL_FIELD_KEYS]);

const SYSTEM = `Du bist ein Daten-Extraktor für technische Produktunterlagen (ESPR / Digital Product Passport).
Du erhältst den Volltext eines PDFs (mit Seiten-Markern). Extrahiere **nur** Informationen, die wörtlich oder eindeutig im Text stehen. Erfinde nichts.

Antworte mit **genau einem JSON-Objekt** (ohne Markdown). Top-Level-Keys sind **ausschließlich** die vorgegebene Liste.

Extrahiere die Daten STRENG nach diesem Schema. Nutze niemals deutsche Keys für Top-Level-Namen!

---

## chemicalComposition — Massenanteile / Gew.-%, Abschnitt 3 Sicherheitsdatenblatt

Mappe hier **die vollständige produktbezogene Zusammensetzung** (nicht nur Einzelgefahren): **jeden Eintrag aus der Gehalts-/Bestandteilstabelle** als eigenes Objekt im Array \`chemicalComposition.value\`.

Pflicht für diese Objekte:
- \`stoffname\`: Stoff-/Gemischbezeichnung wie im SDB.
- \`prozentAnteil\`: **genau die %-Angabe(n) aus der Tabelle** (Einzelwert oder Bereich), z. B. \`"≥ 99"\`, \`"40 – 60 %"\`, \`"< 1 %"\`.
- \`casNummer\`: CAS wie angegeben oder null.
- \`einstufung\`: Einstufung/H-Sätze zur Komponente oder null.

**Summe:** Alle ausgewiesenen Massen-/Gew.-Anteile dieser Zeilen müssen sich **logisch zu 100 %** der ausgewiesenen Zusammensetzung ergänzen (Rest-/„Sonstige Bestandteile“-Zeile aus dem SDB mit übernehmen, wenn vorhanden). Keine Stoffzeilen aus Abschnitt 3 weglassen. Keine Kommaliste als einen einzigen Freitext — immer strukturierte Zeilen.

---

## substancesOfConcern — besorgniserregende / ausgewiesene Stoffe **separat**

Alles was im SDB **explizit als besorgniserregend**, SVHC, Grenzwert-/Zulassungsbedingungen, **spezifische Konzentrationsgrenzen** oder vergleichbare **gesonderte Hinweise** geführt wird (oft eigene Unterabschnitte, Grenzwerte, SVHC-Tabelle): als **eigenes Objekt** im Array \`substancesOfConcern.value\` ausgeben — **nicht** mit den Massen-% der Gesamtzusammensetzung vermischen.

Felder:
- \`name\`: Bezeichnung wie im Dokument.
- \`casNummer\`: CAS oder null.
- \`anteilOderGrenzwert\`: zulässiger Anteil / Grenzwert / Konzentration wie angegeben oder null.
- \`hinweis\`: regulatorischer Hinweis (z. B. SVHC, spezifische Einstufung) oder null.

Wenn der Abschnitt fehlt oder keine gesonderten Einträge vorliegen: Key \`substancesOfConcern\` **weglassen**.

---

## Alle anderen Felder

- Entsorgung / Abschnitt 13 → endOfLifeInstructions
- Hersteller → hersteller (nicht manufacturer)
- Produktbezeichnung Deckblatt → productName
- Modell → modellname
- EWC / AVV → ewcCode
- GTIN / EAN → gtin

**Andere Felder** außer chemicalComposition/substancesOfConcern: wie gewohnt

{
  "value": string | null,
  "sourcePdf": string,
  "contextSnippet": string
}

Regeln:
- Kennzahlen außerhalb chemicalComposition/substancesOfConcern als String in "value".
- GTIN nur als Ziffernfolge aus dem Text.

Wenn ein Feld nicht extrahierbar ist: Top-Level-Key weglassen — keine leeren Platzhalter.`;

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

    const cc = validated.data.chemicalComposition?.value;
    if (cc && cc.length > 0 && !isSdsCompositionMassSumPlausible(cc)) {
      console.warn('[EAGER] SDS Abschnitt 3: Massenanteile nicht ~100 % (Schätzung aus %-Angaben)', {
        approximateSumPercent: sumApproximateMassPercents(cc),
        fileName: input.fileName,
      });
    }

    return eagerExtractionResponseToRows(validated.data, input.fileName);
  }
}
