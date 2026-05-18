import type { AuditTrail, AuditedValue } from '@/app/domain/rag/auditTrailSchema';
import type { ProductPassport } from '@/app/types/dpp-types';

/** Strings, die wie „leer“ wirken und von echten RAG-Werten überschrieben werden sollen. */
function isPlaceholderScalarString(value: string): boolean {
  const t = value.trim();
  if (t === '') {
    return true;
  }
  const lower = t.toLowerCase();
  if (
    lower === 'null'
    || lower === 'undefined'
    || lower === 'n/a'
    || lower === 'na'
    || t === '—'
    || t === '-'
  ) {
    return true;
  }
  if (t === '0' || t === '0.0' || t === '0,0') {
    return true;
  }
  return false;
}

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
  if (typeof value === 'string') {
    const t = value.trim();
    if (t === '' || t === 'PENDING_EXTERNAL_MATCH' || isPlaceholderScalarString(value)) {
      return true;
    }
  }
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const o = value as Record<string, unknown>;
    if ('value' in o) {
      const inner = o.value;
      if (inner === undefined || inner === null) {
        return true;
      }
      if (typeof inner === 'string') {
        const ts = inner.trim();
        if (ts === '' || ts === 'PENDING_EXTERNAL_MATCH' || isPlaceholderScalarString(inner)) {
          return true;
        }
      }
      if (Array.isArray(inner) && inner.length === 0) {
        return true;
      }
      return false;
    }
  }
  return false;
}

/** Formatiert H/P/GHS-Listen aus einem Strukturfragment (RAG-Passport oder LLM-Zeilen). */
function formatHazardStatementAppendix(o: Record<string, unknown>): string[] {
  const pickStrings = (v: unknown): string[] => {
    if (!Array.isArray(v)) {
      return [];
    }
    return v
      .filter((x): x is string => typeof x === 'string')
      .map((s) => s.trim())
      .filter(Boolean);
  };
  const h = [...pickStrings(o.hStatements), ...pickStrings(o.hazardStatements), ...pickStrings(o.hSaetze)];
  const p = [
    ...pickStrings(o.pStatements),
    ...pickStrings(o.precautionaryStatements),
    ...pickStrings(o.pSaetze),
  ];
  const g = [...pickStrings(o.ghsPictograms), ...pickStrings(o.ghsSymbols), ...pickStrings(o.gefahrenpiktogramme)];
  const uniq = (xs: string[]) => [...new Set(xs)];
  const hu = uniq(h);
  const pu = uniq(p);
  const gu = uniq(g);
  const out: string[] = [];
  if (hu.length > 0) {
    out.push(`H ${hu.join(', ')}`);
  }
  if (pu.length > 0) {
    out.push(`P ${pu.join(', ')}`);
  }
  if (gu.length > 0) {
    out.push(`GHS ${gu.join(', ')}`);
  }
  return out;
}

/** Konvertiert strukturierte besorgniserregende Stoffe → `gefahrenstoffe?: string[]` auf dem Produktpass. */
function formatGefahrenstoffStringsFromStructured(rows: readonly unknown[]): string[] {
  return rows.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return String(item);
    }
    const o = item as Record<string, unknown>;
    const name = typeof o.name === 'string' ? o.name.trim() : '';
    const cas =
      o.casNummer !== null && o.casNummer !== undefined && String(o.casNummer).trim()
        ? `CAS ${String(o.casNummer).trim()}`
        : '';
    const anteil =
      o.anteilOderGrenzwert !== null
      && o.anteilOderGrenzwert !== undefined
      && String(o.anteilOderGrenzwert).trim()
        ? String(o.anteilOderGrenzwert).trim()
        : '';
    const hinweis =
      o.hinweis !== null && o.hinweis !== undefined && String(o.hinweis).trim()
        ? String(o.hinweis).trim()
        : '';
    const hpParts = formatHazardStatementAppendix(o);
    const line = [...[name || '(ohne Namen)', cas, anteil, hinweis].filter(Boolean), ...hpParts].join(' · ');
    return line.length > 0 ? line : JSON.stringify(o);
  });
}

const REGULATORY_CODE_LIST_KEYS = new Set(['hStatements', 'pStatements', 'ghsSymbols']);

function isRegulatoryCodeListAudited(key: string, audited: AuditedValue): boolean {
  if (!REGULATORY_CODE_LIST_KEYS.has(key) || audited.value === null) {
    return false;
  }
  return (
    Array.isArray(audited.value)
    && audited.value.length > 0
    && audited.value.every((x) => typeof x === 'string' && x.trim() !== '')
  );
}

function normalizeScalar(key: string, audited: AuditedValue): unknown {
  const raw = audited.value;
  if (raw === null) {
    return null;
  }

  if (Array.isArray(raw)) {
    if (key === 'gefahrenstoffe') {
      return formatGefahrenstoffStringsFromStructured(raw);
    }
    if (raw.length > 0 && raw.every((x) => typeof x === 'string')) {
      const codes = [...new Set(raw.map((x) => String(x).trim()).filter(Boolean))];
      return codes.length > 0 ? codes : null;
    }
    return raw;
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
    if (!audited || audited.value === null) {
      return;
    }
    if (audited.requiresManualReview && !isRegulatoryCodeListAudited(key, audited)) {
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

/**
 * Erkennt RAG-Provenance-Umschläge aus {@link mergeRagAuditIntoPassport} (`sourcePdf` + `value`).
 */
export function isRagProvenanceEnvelope(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const o = value as Record<string, unknown>;
  return (
    'value' in o
    && typeof o.sourcePdf === 'string'
    && o.sourcePdf.trim().length > 0
    && typeof o.contextSnippet === 'string'
  );
}

/**
 * Für Persistenz/API: Hauptfelder des Passes erhalten das extrahierte `value`, nicht den Provenance-Wrapper.
 * `ragEnrichment.auditTrail` behält weiterhin die volle Herkunft.
 */
export function flattenProvenancePatchForPersistence(patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(patch)) {
    if (isRagProvenanceEnvelope(val)) {
      out[key] = (val as Record<string, unknown>).value;
    } else {
      out[key] = val;
    }
  }
  return out;
}
