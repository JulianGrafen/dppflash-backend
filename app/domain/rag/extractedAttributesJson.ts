import type { AuditedValue } from '@/app/domain/rag/auditTrailSchema';
import type { SdsCompositionEntry } from '@/app/domain/rag/sdsCompositionSchema';

/**
 * JSONB shape in `products.extracted_attributes` (per field, from background extraction).
 * `chemicalComposition` (und Synonyme) können strukturierte SDS-Zeilen halten.
 */
export interface ExtractedAttributeRow {
  readonly value: string | null | readonly SdsCompositionEntry[];
  readonly sourcePdf: string;
  readonly contextSnippet: string;
  readonly pageNumber?: number;
  readonly confidence: number;
}

export type ExtractedAttributesMap = Readonly<Record<string, ExtractedAttributeRow>>;

export function hasNonEmptyExtractedRowValue(value: ExtractedAttributeRow['value']): boolean {
  if (value === null) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim() !== '';
  }
  return Array.isArray(value) && value.length > 0;
}


/**
 * Produkt-Anker für `products.normalized_name` nach Eager-Extraktion (Doc B/C),
 * damit Doc A per Fuzzy-Key dieselbe Entity trifft.
 */
export function pickProductEntityAnchorFromExtracted(
  extracted: Readonly<Record<string, ExtractedAttributeRow>>,
  fallbackLabel: string,
): string {
  const pv = extracted.productName?.value;
  const mv = extracted.modellname?.value;
  const productName = typeof pv === 'string' ? pv.trim() : '';
  const modellname = typeof mv === 'string' ? mv.trim() : '';
  const fb = fallbackLabel.trim();
  return productName || modellname || fb;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isCompositionStorageKey(fieldKey: string): boolean {
  const needle = normalizeExtractedFieldKey(fieldKey);
  return synonymLowerNamesForPassportField('chemicalComposition').has(needle);
}

function parseStoredCompositionArray(rawValue: unknown): readonly SdsCompositionEntry[] | null {
  if (!Array.isArray(rawValue)) {
    return null;
  }
  const entries: SdsCompositionEntry[] = [];
  for (const item of rawValue) {
    if (!isRecord(item)) {
      continue;
    }
    const stoffFromDe = typeof item.stoffname === 'string' ? item.stoffname.trim() : '';
    const stoffFromEn =
      typeof item.substance === 'string' ? item.substance.trim() : '';
    const stoffname = stoffFromDe || stoffFromEn;
    if (!stoffname) {
      continue;
    }
    let casNummer: string | null = null;
    if (item.casNummer === null) {
      casNummer = null;
    } else if (typeof item.casNummer === 'string') {
      casNummer = item.casNummer;
    } else if (typeof item.casNumber === 'string') {
      casNummer = item.casNumber;
    }
    const prozentAnteil =
      typeof item.prozentAnteil === 'string'
        ? item.prozentAnteil
        : typeof item.concentrationPercent === 'number' && Number.isFinite(item.concentrationPercent)
          ? `${item.concentrationPercent}%`
          : '';
    let einstufung: string | null = null;
    if (item.einstufung === null || item.einstufung === undefined) {
      einstufung =
        typeof item.function === 'string' && item.function.trim()
          ? item.function.trim()
          : null;
    } else if (typeof item.einstufung === 'string') {
      einstufung = item.einstufung;
    }
    entries.push({
      stoffname,
      casNummer,
      prozentAnteil,
      einstufung,
    });
  }
  return entries.length > 0 ? entries : null;
}

function coerceRow(raw: unknown, fieldKey: string): ExtractedAttributeRow | null {
  if (!isRecord(raw)) {
    return null;
  }

  let value: ExtractedAttributeRow['value'];
  const rawVal = raw.value;
  if (rawVal === null || rawVal === undefined) {
    value = null;
  } else if (isCompositionStorageKey(fieldKey)) {
    const structured = parseStoredCompositionArray(rawVal);
    if (structured) {
      value = structured;
    } else if (typeof rawVal === 'string') {
      value = rawVal;
    } else {
      value = String(rawVal);
    }
  } else if (typeof rawVal === 'string') {
    value = rawVal;
  } else {
    value = String(rawVal);
  }

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
    const row = coerceRow(v, k);
    if (row) {
      out[k] = row;
    }
  }
  return out;
}

/**
 * Safe-Merge für `products.extracted_attributes` (Cumulative Memory):
 * `finalAttributes = { ...existing }` plus neue Keys — Überschreiben nur bei nicht-leerem `value`,
 * damit Archiv-Daten (Doc B/C) beim Upload von Doc A erhalten bleiben inkl. `sourcePdf`.
 */
export function mergeExtractedAttributesJsonForPersistence(
  existingJsonFromDb: unknown,
  incoming: Readonly<Record<string, ExtractedAttributeRow>>,
): Record<string, unknown> {
  const existingAttributes =
    typeof existingJsonFromDb === 'object' && existingJsonFromDb !== null && !Array.isArray(existingJsonFromDb)
      ? { ...(existingJsonFromDb as Record<string, unknown>) }
      : {};

  const mergedAttributes: Record<string, unknown> = { ...existingAttributes };

  for (const [key, fieldData] of Object.entries(incoming)) {
    if (fieldData && hasNonEmptyExtractedRowValue(fieldData.value)) {
      mergedAttributes[key] = {
        value: fieldData.value,
        sourcePdf: fieldData.sourcePdf,
        contextSnippet: fieldData.contextSnippet,
        pageNumber: fieldData.pageNumber ?? 1,
        confidence: fieldData.confidence,
      };
    }
  }

  return mergedAttributes;
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
  const requiresSnippet =
    row.value !== null
    && (typeof row.value === 'string' ? row.contextSnippet.trim().length < 2 : row.contextSnippet.trim().length < 2);
  const valueOut: AuditedValue['value'] =
    row.value !== null && Array.isArray(row.value)
      ? row.value.map((e) => ({ ...e }))
      : (row.value as AuditedValue['value']);
  return {
    value: valueOut,
    confidence: row.confidence,
    source: {
      fileName: row.sourcePdf.trim().length > 0 ? row.sourcePdf : 'unknown',
      pageNumber: row.pageNumber ?? 1,
      contextSnippet: row.contextSnippet.trim().length > 0 ? row.contextSnippet : '—',
    },
    requiresManualReview: requiresSnippet,
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
  [
    'chemicalComposition',
    'materialComposition',
    'materialZusammensetzung',
    'materialzusammensetzung',
    'chemischeZusammensetzung',
    'chemischezusammensetzung',
    'zusammensetzung',
  ],
  ['countryOfOrigin', 'herkunftsland', 'countryoforigin'],
  ['countryOfManufacturing', 'verarbeitungsland', 'herstellungsland', 'countryofmanufacturing'],
  ['productName', 'productname', 'produktname', 'modellname', 'modelName', 'modell', 'model'],
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
    if (!hit || !hasNonEmptyExtractedRowValue(hit.row.value)) {
      keyResolution.push({ missingField, usedStoredKey: hit?.originalKey ?? null });
      continue;
    }
    fields[missingField] = rowToAuditedValue(hit.row);
    keyResolution.push({ missingField, usedStoredKey: hit.originalKey });
  }

  return { fields, keyResolution };
}
