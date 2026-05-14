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

/**
 * Builds an audit trail `fields` map from pre-extracted JSON for keys in `missingFields` only.
 */
export function extractedAttributesToAuditTrailFields(
  stored: Readonly<Record<string, ExtractedAttributeRow>>,
  missingFields: readonly string[],
): { readonly fields: Record<string, AuditedValue> } {
  const fields: Record<string, AuditedValue> = {};
  for (const key of missingFields) {
    const row = stored[key];
    if (!row || row.value === null) {
      continue;
    }
    fields[key] = rowToAuditedValue(row);
  }
  return { fields };
}
