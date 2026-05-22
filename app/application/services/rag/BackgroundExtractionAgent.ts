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

## substancesOfConcern — **Gefährliche / besorgniserregende Inhaltsstoffe** (separat von Massen-%)

Alles was im SDB **explizit als besorgniserregend**, **gefährlich**, SVHC, Grenzwert-/Zulassungsbedingungen, **spezifische Konzentrationsgrenzen**, **H- und P-Sätze für einzelne Stoffe** oder vergleichbare **gesonderte Hinweise** geführt wird (Abschnitt 2/3, Grenzwerttabellen, SVHC-Listen): als **eigenes Objekt** im Array \`substancesOfConcern.value\` — **nicht** mit den Massen-% der Gesamtzusammensetzung vermischen.

Pflicht / empfohlen pro Eintrag:
- \`name\`: Bezeichnung wie im Dokument (oder \`stoffname\` als Synonym).
- \`casNummer\`: CAS-Nummer wörtlich wie im SDB oder null.
- \`anteilOderGrenzwert\`: zulässiger Anteil / Grenzwert / Konzentration wie angegeben oder null.
- \`hinweis\`: regulatorischer Kurz-Hinweis (z. B. SVHC, EUH) oder null.
- \`hStatements\`: **Array** der Gefahrenhinweis-Codes für diesen Stoff, z. B. \`["H315","H317"]\` — aus Abschnitt 2/3 sofern dem Stoff zugeordnet; sonst weglassen oder leer lassen.
- \`pStatements\`: **Array** der Sicherheitshinweis-Codes, z. B. \`["P102","P280"]\`; sonst weglassen.
- \`ghsPictograms\`: **Array** der zugeordneten **GHS-Piktogramm-Codes** wie im Dokument (z. B. \`["GHS07","GHS09"]\` oder die im SDB verwendete Kennzeichnung); nur übernehmen, wenn dem Stoff/Gemisch **explizit** zugeordnet — nicht raten.

Wenn der Abschnitt fehlt oder keine gesonderten Einträge vorliegen: \`substancesOfConcern.value\` als leeres Array \`[]\` ausgeben.

---

WICHTIG FÜR REGULATORISCHE DATEN:

Suche explizit nach der UPI (Unique Product Identifier) oder UFI (Unique Formula Identifier).

Extrahiere alle H-Sätze (Gefahrenhinweise, z.B. H315, H317) als Array in 'hStatements'.

Leite die GHS-Symbole (z.B. GHS05, GHS07) zwingend ab. Wenn Symbole als Bild im PDF waren, nutze die extrahierten H-Sätze, um nach der CLP-Verordnung das korrekte GHS-Symbol zu erschließen und als Array in 'ghsSymbols' einzutragen.

---

WICHTIGE REGEL FÜR COMPLIANCE UND GEFAHRSTOFFE:

H-Sätze & P-Sätze: Extrahiere alle Gefahrenhinweise (H-Sätze, z.B. H315) und Sicherheitshinweise (P-Sätze, z.B. P102) aus Abschnitt 2 des Sicherheitsdatenblatts als strikte String-Arrays.

GHS-Symbole: Da PDFs Bildsymbole oft verschlucken, MUSST du die GHS-Symbole (z.B. GHS05, GHS07) logisch aus den extrahierten H-Sätzen ableiten und als Array ausgeben.

Bedenkliche Stoffe (SVHC): Extrahiere Stoffe für 'substancesOfConcern' AUSSCHLIESSLICH dann, wenn sie im Dokument (meist Abschnitt 3 oder 15) explizit als SVHC, 'Besonders besorgniserregende Stoffe' oder unter REACH-Kandidatenliste aufgeführt sind. Rate niemals! Wenn keine explizit genannt sind, gib ein leeres Array zurück.

---

WICHTIGE REGEL FÜR MERKBLÄTTER UND ANLEITUNGEN:
Achte explizit auf Absätze mit Titeln wie 'HINWEISE', 'Verarbeitung' oder 'Reinigung'.

- **Handhabung & Praxis-Hinweise:** Scanne das Dokument intensiv nach Abschnitten wie 'HINWEISE', 'Verarbeitung', 'Wichtige Hinweise', 'Anwendung' oder 'Reinigung'. Extrahiere konkrete Anweisungen für den Anwender (z. B. sofortige Reinigung von Werkzeugen mit Wasser, Entfernung von Mörtelresten zur Vermeidung von Flecken, Einhaltung relevanter Normen). Speichere diese präzise zusammengefasst im Feld \`handlingAndApplicationInstructions.value\` (gleichbedeutend mit dem Alias \`handlingInstructions\`). Juristische Standard-Haftungsausschlüsse ignorieren!

---

## Alle anderen Felder

- Entsorgung / Abschnitt 13 → endOfLifeInstructions
- Hersteller → hersteller (nicht manufacturer)
- Produktbezeichnung Deckblatt → productName
- Modell → modellname
- Kennzeichnung UPI / UFI im Text → \`upi\` (Skalarfeld mit value/sourcePdf/contextSnippet)
- EWC / AVV → ewcCode
- GTIN / EAN → gtin
- SKU / Artikelnummer / Art.-Nr. / Bestellnummer / Produktcode (alphanumerisch, **keine** GTIN) → sku
- Gemischbezogene **Gefahrenhinweis-Codes** (Summe/Zeilen aus Abschnitt 2 ohne einzelnen Stoffzuordnung) → \`hStatements.value\` als **Array von Strings**, z.B. ["H302","EUH208"]
- Gemischbezogene **Sicherheitshinweis-Codes** → \`pStatements.value\` als **Array von Strings**, z.B. ["P102","P280"]
- **GHS-Kennzeichnungscode** für das Produktgemisch → \`ghsSymbols.value\` als **Array**, z.B. ["GHS05"]
- **Technische Merkblätter/Anleitungen** — Handhabung, Verarbeitung, Reinigung, Schutz-/Normbezugshinweise (ohne Haftungsausschlüsse) → \`handlingAndApplicationInstructions\`

**Andere Felder** außer chemicalComposition/substancesOfConcern/\`hStatements\`/\`pStatements\`/\`ghsSymbols\`/\`handlingAndApplicationInstructions\`: wie gewohnt

{
  "value": string | null,
  "sourcePdf": string,
  "contextSnippet": string,
  "confidence": number
}

**Konfidenz (Pflicht pro ausgegebenem Feld):** \`confidence\` ist eine Zahl zwischen **0.0 und 1.0** — deine Einschätzung, wie eindeutig der Wert im Dokument belegt ist:
- **0.95–1.0:** wörtlich/exakt im Text (Tabellenzeile, feste Kennzeichnung, eindeutiges Label)
- **0.80–0.94:** klar erkennbar, geringe Formatierung oder leichte Zusammenfassung
- **0.60–0.79:** indirekt oder aus Kontext ableitbar, aber plausibel
- **< 0.60:** unsicher — Feld **weglassen**, nicht raten

Für \`hStatements\`, \`pStatements\`, \`ghsSymbols\` und \`substancesOfConcern\` ist \`value\` jeweils \`string[] | null\`; \`sourcePdf\`, \`contextSnippet\` und \`confidence\` bleiben pro Zeile Pflichtfelder wie oben.

Regeln:
- Kennzahlen außer chemicalComposition/substancesOfConcern/\`hStatements\`/\`pStatements\`/\`ghsSymbols\`/\`handlingAndApplicationInstructions\` als String in "value".
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
