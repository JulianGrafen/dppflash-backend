import { z } from 'zod';
import type { ExtractedAttributeRow } from '@/app/domain/rag/extractedAttributesJson';
import { sdsCompositionEntrySchema } from '@/app/domain/rag/sdsCompositionSchema';
import { substanceConcernEntrySchema } from '@/app/domain/rag/substanceConcernSchema';

/** Ein Feld aus der Eager-LLM-Antwort — nur `value` / `sourcePdf` / `contextSnippet` (keine weiteren Keys). */
const eagerExtractionFieldRowSchema = z
  .object({
    value: z.string().nullable(),
    sourcePdf: z.string(),
    contextSnippet: z.string(),
  })
  .strict();

/** SDS Abschnitt 3 — strukturierte Massenanteile (Materialzusammensetzung / chemicalComposition). */
export const eagerChemicalCompositionFieldRowSchema = z
  .object({
    value: z.array(sdsCompositionEntrySchema).nullable(),
    sourcePdf: z.string(),
    contextSnippet: z.string(),
  })
  .strict();

/** Besorgniserregende / ausgewiesene Stoffe — separater Slot von der Gesamtzusammensetzung. */
export const eagerSubstancesConcernFieldRowSchema = z
  .object({
    value: z.array(substanceConcernEntrySchema).nullable(),
    sourcePdf: z.string(),
    contextSnippet: z.string(),
  })
  .strict();

/** Kanonische Top-Level-Keys (Reihenfolge für deterministische Alias-Kollisionen). */
export const EAGER_CANONICAL_FIELD_KEYS = [
  'hersteller',
  'productName',
  'modellname',
  'ewcCode',
  'wasteCode',
  'countryOfOrigin',
  'countryOfManufacturing',
  'endOfLifeInstructions',
  'chemicalComposition',
  'substancesOfConcern',
  'gtin',
] as const;

export type EagerCanonicalFieldKey = (typeof EAGER_CANONICAL_FIELD_KEYS)[number];

const EAGER_CANONICAL_SET = new Set<string>(EAGER_CANONICAL_FIELD_KEYS);

/**
 * Aliase (lowercase) → kanonischer Key für `extracted_attributes`.
 * `materialZusammensetzung` / `materialComposition` → `chemicalComposition`; Hersteller-Varianten → `hersteller`.
 */
const EAGER_ALIAS_TO_CANONICAL: Readonly<Record<string, EagerCanonicalFieldKey>> = {
  materialzusammensetzung: 'chemicalComposition',
  materialcomposition: 'chemicalComposition',
  chemischezusammensetzung: 'chemicalComposition',
  manufacturer: 'hersteller',
  herstellername: 'hersteller',
  hersteller: 'hersteller',
  produktname: 'productName',
  productname: 'productName',
  modell: 'modellname',
  model: 'modellname',
  modelname: 'modellname',
  ewc: 'ewcCode',
  ewccode: 'ewcCode',
  wastecode: 'wasteCode',
  waste_code: 'wasteCode',
  countryoforigin: 'countryOfOrigin',
  countryofmanufacturing: 'countryOfManufacturing',
  entsorgungshinweise: 'endOfLifeInstructions',
  endoflifeinstructions: 'endOfLifeInstructions',
  ean: 'gtin',
  gefahrenstoffe: 'substancesOfConcern',
  gefahrlicheinhaltsstoffe: 'substancesOfConcern',
  gefaehrlicheinhaltsstoffe: 'substancesOfConcern',
  besorgniserregendestoffe: 'substancesOfConcern',
  besorgniserregende_stoffe: 'substancesOfConcern',
  svhc: 'substancesOfConcern',
};

function resolveCanonicalEagerKey(rawKey: string): EagerCanonicalFieldKey | null {
  const trimmed = rawKey.trim();
  if (!trimmed) {
    return null;
  }
  const lower = trimmed.toLowerCase();
  const viaAlias = EAGER_ALIAS_TO_CANONICAL[lower];
  if (viaAlias) {
    return viaAlias;
  }
  if (EAGER_CANONICAL_SET.has(trimmed as EagerCanonicalFieldKey)) {
    return trimmed as EagerCanonicalFieldKey;
  }
  for (const k of EAGER_CANONICAL_FIELD_KEYS) {
    if (k.toLowerCase() === lower) {
      return k;
    }
  }
  return null;
}

function isLooseFieldRow(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Ältere LLM-Antworten: ein Freitext → eine SDS-Zeile (nur chemicalComposition). */
export function coerceLegacyChemicalCompositionValue(v: unknown): unknown {
  if (v === null || v === undefined) {
    return null;
  }
  if (Array.isArray(v)) {
    return v;
  }
  if (typeof v === 'string') {
    const t = v.trim();
    if (t.length === 0) {
      return null;
    }
    return [{ stoffname: t, casNummer: null, prozentAnteil: '', einstufung: null }];
  }
  return null;
}

/**
 * Vor Zod: unbekannte / deutsche LLM-Keys auf kanonische Keys mappen; Duplikate auf denselben Key:
 * behält die „informationsreichere“ Zeile (längerer Skalar oder längeres / größeres Array).
 */
export function normalizeEagerExtractionRawObject(source: Record<string, unknown>): Record<string, unknown> {
  const buckets: Partial<Record<EagerCanonicalFieldKey, Record<string, unknown>>> = {};

  const scoreScalarRow = (row: Record<string, unknown>): number => {
    const val = row.value;
    if (val === null || val === undefined) {
      return 0;
    }
    const s = typeof val === 'string' ? val.trim() : String(val).trim();
    return s.length;
  };

  const scoreArrayRow = (row: Record<string, unknown>): number => {
    const val = row.value;
    if (val === null || val === undefined) {
      return 0;
    }
    if (Array.isArray(val)) {
      return val.length * 100_000 + JSON.stringify(val).length;
    }
    if (typeof val === 'string') {
      return val.trim().length;
    }
    return scoreScalarRow(row);
  };

  const scoreRow = (canonical: EagerCanonicalFieldKey, row: Record<string, unknown>): number => {
    if (canonical === 'chemicalComposition' || canonical === 'substancesOfConcern') {
      return scoreArrayRow(row);
    }
    return scoreScalarRow(row);
  };

  for (const [rawKey, v] of Object.entries(source)) {
    if (!isLooseFieldRow(v)) {
      continue;
    }
    const canonical = resolveCanonicalEagerKey(rawKey);
    if (!canonical) {
      continue;
    }
    const prev = buckets[canonical];
    if (!prev) {
      buckets[canonical] = { ...v };
      continue;
    }
    if (scoreRow(canonical, v) > scoreRow(canonical, prev)) {
      buckets[canonical] = { ...v };
    }
  }

  const out = buckets as Record<string, unknown>;
  const cc = out.chemicalComposition;
  if (cc && isLooseFieldRow(cc)) {
    cc.value = coerceLegacyChemicalCompositionValue(cc.value);
  }

  return out;
}

/**
 * Striktes Eager-Schema: nur kanonische Top-Level-Keys, keine weiteren.
 */
export const eagerExtractionResponseSchema = z
  .object({
    hersteller: eagerExtractionFieldRowSchema.optional(),
    productName: eagerExtractionFieldRowSchema.optional(),
    modellname: eagerExtractionFieldRowSchema.optional(),
    ewcCode: eagerExtractionFieldRowSchema.optional(),
    wasteCode: eagerExtractionFieldRowSchema.optional(),
    countryOfOrigin: eagerExtractionFieldRowSchema.optional(),
    countryOfManufacturing: eagerExtractionFieldRowSchema.optional(),
    endOfLifeInstructions: eagerExtractionFieldRowSchema.optional(),
    chemicalComposition: eagerChemicalCompositionFieldRowSchema.optional(),
    substancesOfConcern: eagerSubstancesConcernFieldRowSchema.optional(),
    gtin: eagerExtractionFieldRowSchema.optional(),
  })
  .strict();

/** Alias gemäß Produkt-Spezifikation „eagerExtractionSchema“. */
export const eagerExtractionSchema = eagerExtractionResponseSchema;

export type EagerExtractionResponse = z.infer<typeof eagerExtractionResponseSchema>;

const EAGER_ROW_KEYS = EAGER_CANONICAL_FIELD_KEYS;

/** Default-Konfidenz für Eager-Zeilen, wenn das LLM keine Confidence liefert. */
const EAGER_DEFAULT_CONFIDENCE = 0.88;

function eagerChunkHasExtractableValue(key: EagerCanonicalFieldKey, chunk: { value: unknown }): boolean {
  if (chunk.value === null) {
    return false;
  }
  if (key === 'chemicalComposition' || key === 'substancesOfConcern') {
    return Array.isArray(chunk.value) && chunk.value.length > 0;
  }
  return String(chunk.value).trim() !== '';
}

export function eagerExtractionResponseToRows(
  data: EagerExtractionResponse,
  defaultSourcePdf: string,
): Record<string, ExtractedAttributeRow> {
  const out: Record<string, ExtractedAttributeRow> = {};
  for (const k of EAGER_ROW_KEYS) {
    const chunk = data[k];
    if (!chunk) {
      continue;
    }
    if (!eagerChunkHasExtractableValue(k, chunk)) {
      continue;
    }
    const sourcePdf = chunk.sourcePdf.trim().length > 0 ? chunk.sourcePdf : defaultSourcePdf;
    out[k] = {
      value: chunk.value as ExtractedAttributeRow['value'],
      sourcePdf,
      contextSnippet: chunk.contextSnippet,
      pageNumber: 1,
      confidence: EAGER_DEFAULT_CONFIDENCE,
    };
  }
  return out;
}
