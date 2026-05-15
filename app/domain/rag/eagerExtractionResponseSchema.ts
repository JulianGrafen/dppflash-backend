import { z } from 'zod';
import type { ExtractedAttributeRow } from '@/app/domain/rag/extractedAttributesJson';

/** Ein Feld aus der Eager-LLM-Antwort — nur `value` / `sourcePdf` / `contextSnippet` (keine weiteren Keys). */
const eagerExtractionFieldRowSchema = z
  .object({
    value: z.string().nullable(),
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

/**
 * Vor Zod: unbekannte / deutsche LLM-Keys auf kanonische Keys mappen; Duplikate auf denselben Key:
 * behält die Zeile mit **längerem** nicht-leerem `value` (sonst erste gültige).
 */
export function normalizeEagerExtractionRawObject(source: Record<string, unknown>): Record<string, unknown> {
  const buckets: Partial<Record<EagerCanonicalFieldKey, Record<string, unknown>>> = {};

  const score = (row: Record<string, unknown>): number => {
    const val = row.value;
    if (val === null || val === undefined) {
      return 0;
    }
    const s = typeof val === 'string' ? val.trim() : String(val).trim();
    return s.length;
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
    if (score(v) > score(prev)) {
      buckets[canonical] = { ...v };
    }
  }

  return buckets as Record<string, unknown>;
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
    chemicalComposition: eagerExtractionFieldRowSchema.optional(),
    gtin: eagerExtractionFieldRowSchema.optional(),
  })
  .strict();

/** Alias gemäß Produkt-Spezifikation „eagerExtractionSchema“. */
export const eagerExtractionSchema = eagerExtractionResponseSchema;

export type EagerExtractionResponse = z.infer<typeof eagerExtractionResponseSchema>;

const EAGER_ROW_KEYS = EAGER_CANONICAL_FIELD_KEYS;

/** Default-Konfidenz für Eager-Zeilen, wenn das LLM keine Confidence liefert. */
const EAGER_DEFAULT_CONFIDENCE = 0.88;

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
    if (chunk.value === null || String(chunk.value).trim() === '') {
      continue;
    }
    const sourcePdf = chunk.sourcePdf.trim().length > 0 ? chunk.sourcePdf : defaultSourcePdf;
    out[k] = {
      value: chunk.value,
      sourcePdf,
      contextSnippet: chunk.contextSnippet,
      pageNumber: 1,
      confidence: EAGER_DEFAULT_CONFIDENCE,
    };
  }
  return out;
}
