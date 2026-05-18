import type { AuditedValue } from '@/app/domain/rag/auditTrailSchema';
import type { SdsCompositionEntry } from '@/app/domain/rag/sdsCompositionSchema';
import type { SubstanceConcernEntry } from '@/app/domain/rag/substanceConcernSchema';
import { substanceConcernEntrySchema } from '@/app/domain/rag/substanceConcernSchema';

export type ExtractedStructuredValue =
  | string
  | null
  | readonly SdsCompositionEntry[]
  | readonly SubstanceConcernEntry[]
  /** Gemisch-Level H-/GHS-Code Listen aus Eager-Extraktion. */
  | readonly string[];

/**
 * JSONB shape in `products.extracted_attributes` (per field, from background extraction).
 */
export interface ExtractedAttributeRow {
  readonly value: ExtractedStructuredValue;
  readonly sourcePdf: string;
  readonly contextSnippet: string;
  readonly pageNumber?: number;
  readonly confidence: number;
}

export type ExtractedAttributesMap = Readonly<Record<string, ExtractedAttributeRow>>;

export function hasNonEmptyExtractedRowValue(value: ExtractedStructuredValue): boolean {
  if (value === null) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim() !== '';
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return false;
    }
    if (typeof value[0] === 'string') {
      return value.some((x) => typeof x === 'string' && x.trim() !== '');
    }
    return true;
  }
  return false;
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
  [
    'substancesOfConcern',
    'gefahrenstoffe',
    'gefaehrlicheInhaltsstoffe',
    'gefährlicheInhaltsstoffe',
    'besorgniserregendestoffe',
    'besorgniserregendeStoffe',
    'svhc',
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
  ['upi', 'ufi', 'uniqueProductIdentifier', 'uniqueFormulaIdentifier'],
  ['hStatements', 'hazardStatements', 'hSaetze', 'productHazardStatements'],
  ['pStatements', 'precautionaryStatements', 'pSaetze', 'productPrecautionaryStatements'],
  ['ghsSymbols', 'ghsPictograms', 'gefahrenpiktogramme', 'gefahrenSymbole'],
  [
    'handlingAndApplicationInstructions',
    'verarbeitungshinweise',
    'verarbeitung',
    'hinweise',
    'wichtigeHinweise',
    'processingInstructions',
    'anwendungsanweisungen',
    'reinigung',
    'reinigungsanweisungen',
    'reinigungsHinweise',
    'pflegehinweise',
    'wartungshinweise',
    /** Gemisch-Anwendungs-Hinweise (Chemie/Lacke → oft „Verwendung“ auf dem Passport). */
    'verwendung',
  ],
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

function isCompositionStorageKey(fieldKey: string): boolean {
  return synonymLowerNamesForPassportField('chemicalComposition').has(normalizeExtractedFieldKey(fieldKey));
}

function isSubstancesConcernStorageKey(fieldKey: string): boolean {
  return synonymLowerNamesForPassportField('substancesOfConcern').has(normalizeExtractedFieldKey(fieldKey));
}

function isFlatStringCodesExtractedSlot(fieldKey: string): boolean {
  return ['hStatements', 'pStatements', 'ghsSymbols', 'substancesOfConcern'].some((canonical) =>
    synonymLowerNamesForPassportField(canonical).has(normalizeExtractedFieldKey(fieldKey)),
  );
}

function parseStoredFlatStringCodesArray(rawValue: unknown): readonly string[] | null {
  if (!Array.isArray(rawValue)) {
    return null;
  }
  const codes = rawValue
    .filter((x): x is string => typeof x === 'string')
    .map((x) => x.trim())
    .filter(Boolean);
  const uniq = [...new Set(codes)];
  return uniq.length > 0 ? uniq : null;
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
    const stoffFromEn = typeof item.substance === 'string' ? item.substance.trim() : '';
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
        typeof item.function === 'string' && item.function.trim() ? item.function.trim() : null;
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

function parseStoredSubstancesArray(rawValue: unknown): readonly SubstanceConcernEntry[] | null {
  if (!Array.isArray(rawValue)) {
    return null;
  }
  const entries: SubstanceConcernEntry[] = [];
  for (const item of rawValue) {
    if (!isRecord(item)) {
      continue;
    }
    const patched: Record<string, unknown> = { ...item };
    const hasName = typeof patched.name === 'string' && String(patched.name).trim().length > 0;
    if (!hasName && typeof item.stoffname === 'string' && item.stoffname.trim()) {
      patched.name = item.stoffname;
    }
    if (
      (typeof patched.hinweis !== 'string' || String(patched.hinweis).trim() === '')
      && typeof item.einstufung === 'string'
      && item.einstufung.trim()
    ) {
      patched.hinweis = item.einstufung;
    }
    const parsed = substanceConcernEntrySchema.safeParse(patched);
    if (parsed.success) {
      entries.push(parsed.data);
    }
  }
  return entries.length > 0 ? entries : null;
}

function coerceRow(raw: unknown, fieldKey: string): ExtractedAttributeRow | null {
  if (!isRecord(raw)) {
    return null;
  }

  let value: ExtractedStructuredValue;
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
  } else if (isSubstancesConcernStorageKey(fieldKey)) {
    const structured = parseStoredSubstancesArray(rawVal);
    if (structured) {
      value = structured;
    } else if (typeof rawVal === 'string') {
      value = rawVal;
    } else {
      value = String(rawVal);
    }
  } else if (isFlatStringCodesExtractedSlot(fieldKey)) {
    const codes = parseStoredFlatStringCodesArray(rawVal);
    value = codes ?? (typeof rawVal === 'string' ? rawVal : String(rawVal));
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
 * Freitext-Slots aus technischen Merkblättern: bei erneuter Extraktion kürzeren Text NICHT gegen
 * längere Archiv-/Vorgänger-Volltexte austauschen (informationsbewahrendes Überschreiben).
 */
const MERGE_PREFER_KEEP_LONGER_SCALAR_KEYS = new Set<string>([
  'handlingAndApplicationInstructions',
]);

function trimmedScalarLength(row: ExtractedAttributeRow): number {
  return typeof row.value === 'string' ? row.value.trim().length : 0;
}

/**
 * Safe-Merge für `products.extracted_attributes` (Cumulative Memory):
 * `finalAttributes = { ...existing }` plus neue Keys — Überschreiben nur bei nicht-leerem `value`,
 * damit Archiv-Daten (Doc B/C) beim Upload von Doc A erhalten bleiben inkl. `sourcePdf`.
 *
 * Bei \`handlingAndApplicationInstructions\` bleibt der **längere** bestehende Freitext
 * erhalten, damit spätere Extrakte mit Kurzauszügen keine ausführlicheren älteren Merkblatt-Ausschnitte löschen.
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
    if (!fieldData || !hasNonEmptyExtractedRowValue(fieldData.value)) {
      continue;
    }
    if (MERGE_PREFER_KEEP_LONGER_SCALAR_KEYS.has(key)) {
      const priorRaw = existingAttributes[key];
      const priorParsed = priorRaw !== undefined ? coerceRow(priorRaw, key) : null;
      if (
        priorParsed
        && hasNonEmptyExtractedRowValue(priorParsed.value)
        && trimmedScalarLength(priorParsed) >= trimmedScalarLength(fieldData)
      ) {
        continue;
      }
    }
    mergedAttributes[key] = {
      value: fieldData.value,
      sourcePdf: fieldData.sourcePdf,
      contextSnippet: fieldData.contextSnippet,
      pageNumber: fieldData.pageNumber ?? 1,
      confidence: fieldData.confidence,
    };
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

function isFlatRegulatoryCodeList(value: ExtractedStructuredValue): boolean {
  return (
    Array.isArray(value)
    && value.length > 0
    && value.every((x) => typeof x === 'string' && x.trim() !== '')
  );
}

function rowToAuditedValue(row: ExtractedAttributeRow): AuditedValue {
  const snippetTooShort = row.contextSnippet.trim().length < 2;
  /** H/P/GHS-Code-Listen aus Eager sollen ins Pass, auch wenn das Snippet kurz ist. */
  const requiresManualReview =
    row.value !== null && snippetTooShort && !isFlatRegulatoryCodeList(row.value);

  let valueOut: AuditedValue['value'];
  if (row.value !== null && Array.isArray(row.value)) {
    const firstEl = row.value[0];
    if (typeof firstEl === 'string') {
      const codes = row.value.filter((x): x is string => typeof x === 'string').map((s) => s.trim()).filter(Boolean);
      valueOut = [...new Set(codes)] as AuditedValue['value'];
    } else {
      valueOut = row.value.map((e) => ({ ...e })) as AuditedValue['value'];
    }
  } else {
    valueOut = row.value as AuditedValue['value'];
  }

  return {
    value: valueOut,
    confidence: row.confidence,
    source: {
      fileName: row.sourcePdf.trim().length > 0 ? row.sourcePdf : 'unknown',
      pageNumber: row.pageNumber ?? 1,
      contextSnippet: row.contextSnippet.trim().length > 0 ? row.contextSnippet : '—',
    },
    requiresManualReview,
  };
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
