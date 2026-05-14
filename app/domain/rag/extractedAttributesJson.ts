import type { AuditedValue } from '@/app/domain/rag/auditTrailSchema';

/**
 * JSONB shape in `products.extracted_attributes` (per field, from background extraction).
 */
export interface ExtractedAttributeRow {
  readonly value: string | null;
  readonly sourcePdf: string;
  readonly contextSnippet: string;
  readonly pageNumber?: number;
  readonly confidence: number;
}

export type ExtractedAttributesMap = Readonly<Record<string, ExtractedAttributeRow>>;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function coerceRow(raw: unknown): ExtractedAttributeRow | null {
  if (!isRecord(raw)) {
    return null;
  }
  const value =
    raw.value === null || raw.value === undefined
      ? null
      : typeof raw.value === 'string'
        ? raw.value
        : String(raw.value);
  const sourcePdf = typeof raw.sourcePdf === 'string' ? raw.sourcePdf : '';
  const contextSnippet = typeof raw.contextSnippet === 'string' ? raw.contextSnippet : '';
  const conf = typeof raw.confidence === 'number' && Number.isFinite(raw.confidence) ? raw.confidence : 0;
  const pageNumber =
    typeof raw.pageNumber === 'number' && Number.isFinite(raw.pageNumber) && raw.pageNumber >= 1
      ? Math.floor(raw.pageNumber)
      : 1;
  return {
    value,
    sourcePdf,
    contextSnippet,
    pageNumber,
    confidence: Math.min(1, Math.max(0, conf)),
  };
}

/** Parses loose JSON from DB into a typed map (invalid entries dropped). */
export function parseExtractedAttributesJson(raw: unknown): Record<string, ExtractedAttributeRow> {
  if (!isRecord(raw)) {
    return {};
  }
  const out: Record<string, ExtractedAttributeRow> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!k || k.length > 96) {
      continue;
    }
    const row = coerceRow(v);
    if (row) {
      out[k] = row;
    }
  }
  return out;
}

/**
 * Non-destructive merge for `products.extracted_attributes` persistence:
 * shallow-clones the existing JSONB object so **all** top-level keys stay unless
 * overwritten by `incoming`; per-key updates respect **higher confidence** when
 * both sides coerce to {@link ExtractedAttributeRow}.
 */
export function mergeExtractedAttributesJsonForPersistence(
  existingJsonFromDb: unknown,
  incoming: Readonly<Record<string, ExtractedAttributeRow>>,
): Record<string, unknown> {
  const base =
    typeof existingJsonFromDb === 'object' && existingJsonFromDb !== null && !Array.isArray(existingJsonFromDb)
      ? { ...(existingJsonFromDb as Record<string, unknown>) }
      : {};

  const merged: Record<string, unknown> = { ...base };

  for (const [k, inc] of Object.entries(incoming)) {
    const prev = coerceRow(merged[k]);
    if (prev && inc.confidence < prev.confidence) {
      continue;
    }
    merged[k] = {
      value: inc.value,
      sourcePdf: inc.sourcePdf,
      contextSnippet: inc.contextSnippet,
      pageNumber: inc.pageNumber ?? 1,
      confidence: inc.confidence,
    };
  }

  return merged;
}

export function mergeExtractedAttributesMaps(
  existing: Readonly<Record<string, ExtractedAttributeRow>>,
  incoming: Readonly<Record<string, ExtractedAttributeRow>>,
): Record<string, ExtractedAttributeRow> {
  const out: Record<string, ExtractedAttributeRow> = { ...existing };
  for (const [k, inc] of Object.entries(incoming)) {
    const prev = out[k];
    if (!prev || inc.confidence >= prev.confidence) {
      out[k] = inc;
    }
  }
  return out;
}

function rowToAuditedValue(row: ExtractedAttributeRow): AuditedValue {
  return {
    value: row.value,
    confidence: row.confidence,
    source: {
      fileName: row.sourcePdf.trim().length > 0 ? row.sourcePdf : 'unknown',
      pageNumber: row.pageNumber ?? 1,
      contextSnippet: row.contextSnippet.trim().length > 0 ? row.contextSnippet : '—',
    },
    requiresManualReview: row.value !== null && row.contextSnippet.trim().length < 2,
  };
}

/** Lowercase trim for resilient key matching between passport gaps and JSONB keys. */
function normalizeExtractedFieldKey(key: string): string {
  return key.trim().toLowerCase();
}

/**
 * Passport / gap keys that refer to the same semantic slot in `extracted_attributes`
 * (LLM casing, English vs. German labels, legacy spellings).
 */
const FIELD_KEY_SYNONYM_GROUPS: readonly (readonly string[])[] = [
  ['hersteller', 'manufacturer', 'herstellername', 'herstellerName', 'Manufacturer', 'Hersteller'],
  ['ewcCode', 'wasteCode', 'ewc', 'waste_code', 'ewc_code', 'EWC', 'WasteCode'],
  ['materialComposition', 'materialZusammensetzung', 'materialzusammensetzung'],
  ['chemicalComposition', 'chemischeZusammensetzung', 'chemischezusammensetzung'],
  ['countryOfOrigin', 'herkunftsland', 'countryoforigin'],
  ['countryOfManufacturing', 'verarbeitungsland', 'herstellungsland', 'countryofmanufacturing'],
  ['productName', 'productname', 'produktname'],
  ['modellname', 'modelName', 'modell', 'model'],
  ['declaredProductType', 'declaredproducttype', 'produkttyp'],
  ['endOfLifeInstructions', 'entsorgungshinweise', 'endoflifeinstructions'],
  ['gtin', 'ean'],
  ['nachhaltigkeit', 'sustainability'],
  ['gewichtKg', 'gewicht', 'weightKg', 'weight'],
  ['kapazitaetKWh', 'kapazitaet', 'capacityKWh'],
];

function synonymLowerNamesForPassportField(passportFieldKey: string): ReadonlySet<string> {
  const needle = normalizeExtractedFieldKey(passportFieldKey);
  for (const group of FIELD_KEY_SYNONYM_GROUPS) {
    const lowers = new Set(group.map((g) => normalizeExtractedFieldKey(g)));
    if (lowers.has(needle)) {
      return lowers;
    }
  }
  return new Set([needle]);
}

/** Case-insensitive index; duplicate normalized keys keep the row with higher confidence. */
function buildStoredAttributeLookup(
  stored: Readonly<Record<string, ExtractedAttributeRow>>,
): ReadonlyMap<string, { readonly originalKey: string; readonly row: ExtractedAttributeRow }> {
  const map = new Map<string, { originalKey: string; row: ExtractedAttributeRow }>();
  for (const [originalKey, row] of Object.entries(stored)) {
    const norm = normalizeExtractedFieldKey(originalKey);
    if (!norm) {
      continue;
    }
    const prev = map.get(norm);
    if (!prev || row.confidence >= prev.row.confidence) {
      map.set(norm, { originalKey, row });
    }
  }
  return map;
}

function resolveStoredRowForMissingField(
  lookup: ReadonlyMap<string, { readonly originalKey: string; readonly row: ExtractedAttributeRow }>,
  missingField: string,
): { readonly originalKey: string; readonly row: ExtractedAttributeRow } | null {
  const synonyms = synonymLowerNamesForPassportField(missingField);
  for (const syn of synonyms) {
    const hit = lookup.get(syn);
    if (hit?.row) {
      return hit;
    }
  }
  return null;
}

export interface ExtractedAttributesToAuditTrailResult {
  readonly fields: Record<string, AuditedValue>;
  /** passport gap key → JSON key actually used (debug). */
  readonly keyResolution: readonly { readonly missingField: string; readonly usedStoredKey: string | null }[];
}

/**
 * Builds an audit trail `fields` map from pre-extracted JSON for keys in `missingFields` only.
 * Matching is **case-insensitive** and uses **synonym groups** (e.g. `hersteller` ↔ `manufacturer`).
 * Output keys are always the **passport** keys from `missingFields` so downstream merge stays stable.
 */
export function extractedAttributesToAuditTrailFields(
  stored: Readonly<Record<string, ExtractedAttributeRow>>,
  missingFields: readonly string[],
): ExtractedAttributesToAuditTrailResult {
  const fields: Record<string, AuditedValue> = {};
  const keyResolution: { missingField: string; usedStoredKey: string | null }[] = [];
  const lookup = buildStoredAttributeLookup(stored);

  for (const missingField of missingFields) {
    const hit = resolveStoredRowForMissingField(lookup, missingField);
    if (!hit || hit.row.value === null) {
      keyResolution.push({ missingField, usedStoredKey: hit?.originalKey ?? null });
      continue;
    }
    fields[missingField] = rowToAuditedValue(hit.row);
    keyResolution.push({ missingField, usedStoredKey: hit.originalKey });
  }

  return { fields, keyResolution };
}
