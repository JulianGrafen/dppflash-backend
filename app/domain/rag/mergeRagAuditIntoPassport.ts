import type { AuditTrail, AuditedValue } from '@/app/domain/rag/auditTrailSchema';
import type { ProductPassport } from '@/app/types/dpp-types';

const NUMERIC_FIELDS = new Set<string>([
  'kapazitaetKWh',
  'nennspannungV',
  'gewichtKg',
  'co2FussabdruckKgGesamt',
  'co2FussabdruckKgProKwh',
  'recyclinganteilKobalt',
  'recyclinganteilLithium',
  'recyclinganteilNickel',
  'erwarteteLebensdauerLadezyklen',
  'reparierbarkeitsIndex',
  'ersatzteileVerfuegbarkeitJahre',
  'stromverbrauch',
  'lebensdauer',
  'gewicht',
  'voc',
]);

function isEmptyPassportValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  if (Array.isArray(value) && value.length === 0) {
    return true;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return true;
  }
  if (typeof value === 'string' && value.trim() === 'PENDING_EXTERNAL_MATCH') {
    return true;
  }
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const o = value as Record<string, unknown>;
    if ('value' in o) {
      const inner = o.value;
      if (inner === undefined || inner === null) {
        return true;
      }
      if (typeof inner === 'string' && inner.trim() === '') {
        return true;
      }
      if (typeof inner === 'string' && inner.trim() === 'PENDING_EXTERNAL_MATCH') {
        return true;
      }
      return false;
    }
  }
  return false;
}

function normalizeScalar(key: string, audited: AuditedValue): unknown {
  const raw = audited.value;
  if (raw === null) {
    return null;
  }

  if (NUMERIC_FIELDS.has(key)) {
    const n = Number.parseFloat(String(raw).replace(',', '.'));
    if (!Number.isFinite(n)) {
      return null;
    }
    return n;
  }

  return raw;
}

export interface MergeRagAuditOptions {
  /**
   * `provenance`: patch values as `{ value, contextSnippet, sourcePdf, pageNumber?, confidence? }`
   * for UI source attribution (Eager path). Default: scalar-only (backward compatible).
   */
  readonly fieldShape?: 'scalar' | 'provenance';
}

/**
 * Fills only **empty** passport keys from RAG-audited `fields` (and legacy top-level gtin/ewc).
 * Skips entries that require manual review or have null values.
 */
export function mergeRagAuditIntoPassport(
  passport: ProductPassport,
  trail: AuditTrail,
  allowedKeys: ReadonlySet<string> | readonly string[],
  options?: MergeRagAuditOptions,
): {
  readonly patch: Record<string, unknown>;
  readonly appliedKeys: readonly string[];
} {
  const allowed = allowedKeys instanceof Set ? allowedKeys : new Set(allowedKeys);
  const patch: Record<string, unknown> = {};
  const applied: string[] = [];
  const fieldShape = options?.fieldShape ?? 'scalar';

  const tryApply = (key: string, audited: AuditedValue | undefined) => {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      return;
    }
    if (!audited || audited.value === null || audited.requiresManualReview) {
      return;
    }
    if (!allowed.has(key)) {
      return;
    }
    const current = (passport as Record<string, unknown>)[key];
    if (!isEmptyPassportValue(current)) {
      return;
    }
    const normalized = normalizeScalar(key, audited);
    if (normalized === null && audited.value !== null) {
      return;
    }
    if (normalized === null) {
      return;
    }
    if (fieldShape === 'provenance') {
      patch[key] = {
        value: normalized,
        contextSnippet: audited.source.contextSnippet,
        sourcePdf: audited.source.fileName,
        pageNumber: audited.source.pageNumber,
        confidence: audited.confidence,
      };
    } else {
      patch[key] = normalized;
    }
    applied.push(key);
  };

  if (trail.fields) {
    for (const [key, audited] of Object.entries(trail.fields)) {
      tryApply(key, audited);
    }
  }

  tryApply('gtin', trail.fields?.ean);
  tryApply('gtin', trail.gtin);
  tryApply('ewcCode', trail.ewcCode);
  // ESPR-Produktseite nutzt `wasteCode`; Legacy-Audit oft nur `ewcCode` / `fields.ewcCode`.
  tryApply('wasteCode', trail.fields?.ewcCode);
  tryApply('wasteCode', trail.ewcCode);

  return { patch, appliedKeys: applied };
}
