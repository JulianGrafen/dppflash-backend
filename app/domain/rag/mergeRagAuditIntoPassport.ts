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
  if (typeof value === 'string' && value.trim() === '') {
    return true;
  }
  if (typeof value === 'string' && value.trim() === 'PENDING_EXTERNAL_MATCH') {
    return true;
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

/**
 * Fills only **empty** passport keys from RAG-audited `fields` (and legacy top-level gtin/ewc).
 * Skips entries that require manual review or have null values.
 */
export function mergeRagAuditIntoPassport(
  passport: ProductPassport,
  trail: AuditTrail,
  allowedKeys: ReadonlySet<string> | readonly string[],
): {
  readonly patch: Record<string, unknown>;
  readonly appliedKeys: readonly string[];
} {
  const allowed = allowedKeys instanceof Set ? allowedKeys : new Set(allowedKeys);
  const patch: Record<string, unknown> = {};
  const applied: string[] = [];

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
    patch[key] = normalized;
    applied.push(key);
  };

  if (trail.fields) {
    for (const [key, audited] of Object.entries(trail.fields)) {
      tryApply(key, audited);
    }
  }

  tryApply('gtin', trail.gtin);
  tryApply('ewcCode', trail.ewcCode);
  // ESPR-Produktseite nutzt `wasteCode`; Legacy-Audit oft nur `ewcCode` / `fields.ewcCode`.
  tryApply('wasteCode', trail.fields?.ewcCode);
  tryApply('wasteCode', trail.ewcCode);

  return { patch, appliedKeys: applied };
}
