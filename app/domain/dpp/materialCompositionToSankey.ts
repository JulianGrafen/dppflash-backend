import {
  compositionGraphSchema,
  type CompositionGraphPayload,
} from '@/app/domain/dpp/dppExtractionZodSchema';

function clampLabel(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) {
    return t;
  }
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

/** Parses percentage from number or strings like "12,5" / "40%". */
export function parseMaterialPercentageLike(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, value);
  }
  if (typeof value !== 'string') {
    return 0;
  }
  const t = value.trim().replace(/\s+/g, '').replace(',', '.');
  if (!t) {
    return 0;
  }
  const n = Number(t.endsWith('%') ? t.slice(0, -1) : t);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function materialLabelFromRow(row: Record<string, unknown>): string {
  const candidates = [
    'material',
    'name',
    'bezeichnung',
    'materialName',
    'stoffname',
    'substance',
    'component',
    'title',
    'description',
  ] as const;
  for (const k of candidates) {
    const v = row[k];
    if (typeof v === 'string' && v.trim()) {
      return v.trim();
    }
  }
  return '';
}

/** Accepts array or JSON string (e.g. from storage/imports). */
export function coerceMaterialCompositionArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const t = value.trim();
    if (!t.startsWith('[')) {
      return [];
    }
    try {
      const parsed: unknown = JSON.parse(t);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Reads a share 0–100 from common DPP / UI / import column names. */
function readMaterialSharePercentFromRow(r: Record<string, unknown>): number {
  const keys = [
    'percentage',
    'sharePercent',
    'anteil',
    'percent',
    'massPercent',
    'share',
    'concentrationPercent',
  ] as const;
  for (const k of keys) {
    if (!(k in r) || r[k] === undefined || r[k] === '') {
      continue;
    }
    const p = parseMaterialPercentageLike(r[k]);
    if (p > 0) {
      return p;
    }
  }
  for (const k of keys) {
    if (!(k in r) || r[k] === undefined || r[k] === '') {
      continue;
    }
    return parseMaterialPercentageLike(r[k]);
  }
  return 0;
}

function normalizeFlatMaterialArray(value: unknown): { readonly material: string; readonly percentage: number }[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const rows: { material: string; percentage: number }[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const r = entry as Record<string, unknown>;
    const material = materialLabelFromRow(r);
    if (!material) {
      continue;
    }
    const pct = readMaterialSharePercentFromRow(r);
    rows.push({ material, percentage: pct });
  }
  return rows;
}

/** Legacy DPP string, e.g. "95% Recyceltes Polyester, 5% Elasthan". */
function rowsFromMaterialZusammensetzungString(text: string): { readonly material: string; readonly percentage: number }[] {
  const rows: { material: string; percentage: number }[] = [];
  const segments = text
    .split(/(?:,|;|\/|\||\n| und )+/i)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const seg of segments) {
    let m = seg.match(/^(\d+(?:[.,]\d+)?)\s*%\s*(.+)$/i);
    if (m?.[1] && m[2]) {
      rows.push({
        material: m[2].trim(),
        percentage: parseMaterialPercentageLike(m[1]),
      });
      continue;
    }
    m = seg.match(/^(.+?)\s*[:\-]\s*(\d+(?:[.,]\d+)?)\s*%$/i);
    if (m?.[1] && m[2]) {
      rows.push({
        material: m[1].trim(),
        percentage: parseMaterialPercentageLike(m[2]),
      });
      continue;
    }
    m = seg.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*%$/i);
    if (m?.[1] && m[2]) {
      rows.push({
        material: m[1].trim(),
        percentage: parseMaterialPercentageLike(m[2]),
      });
    }
  }
  return rows;
}

/**
 * Passport **core** material sources only (ESPR / legacy UI): structured `materialComposition`
 * and textile-style `materialZusammensetzung` text. Does not use regulatory extraction, RAG, or
 * `chemicalComposition` so Sankey copy matches real Kernfelder data.
 */
export function collectPassportCoreMaterialRowsForSankey(
  raw: Record<string, unknown>,
): ReadonlyArray<{ readonly material: string; readonly percentage: number }> {
  const fromFlat = normalizeFlatMaterialArray(coerceMaterialCompositionArray(raw.materialComposition));
  if (fromFlat.length > 0) {
    return fromFlat;
  }

  const mzRaw = raw.materialZusammensetzung;
  const mzInner =
    mzRaw && typeof mzRaw === 'object' && !Array.isArray(mzRaw) && 'value' in mzRaw
      ? (mzRaw as Record<string, unknown>).value
      : mzRaw;
  const fromMzArray = normalizeFlatMaterialArray(
    Array.isArray(mzInner) ? mzInner : coerceMaterialCompositionArray(mzInner),
  );
  if (fromMzArray.length > 0) {
    return fromMzArray;
  }

  if (typeof raw.materialZusammensetzung === 'string' && raw.materialZusammensetzung.trim()) {
    const fromMz = rowsFromMaterialZusammensetzungString(raw.materialZusammensetzung);
    if (fromMz.length > 0) {
      return fromMz;
    }
  }
  return [];
}

export function compositionGraphHasMeaningfulFlows(graph: CompositionGraphPayload): boolean {
  const total = graph.links.reduce((s, l) => s + l.value, 0);
  return total > 0.05;
}

function buildSankeyFromRows(
  rows: readonly { readonly material: string; readonly percentage: number }[],
  productLabel: string,
): CompositionGraphPayload | null {
  if (rows.length === 0) {
    return null;
  }

  const sumPct = rows.reduce((a, r) => a + r.percentage, 0);
  /** Declared product percentages when available; else equal split (placeholder). */
  const linkValues =
    sumPct > 0
      ? rows.map((r) => Math.max(0.01, r.percentage))
      : rows.map(() => Math.max(0.01, 100 / rows.length));

  const productId = 'end_product';
  const endLabel =
    productLabel.trim().length > 0 ? clampLabel(productLabel.trim(), 44) : 'Produkt';

  const nodes = [
    ...rows.map((r, i) => ({
      id: `mat_${i}`,
      label: clampLabel(r.material, 42),
      category: 'raw_material' as const,
    })),
    {
      id: productId,
      label: endLabel,
      category: 'final_product' as const,
    },
  ];

  const links = rows.map((_, i) => ({
    source: `mat_${i}`,
    target: productId,
    value: linkValues[i] ?? 0.01,
  }));

  const parsed = compositionGraphSchema.safeParse({ nodes, links });
  return parsed.success ? parsed.data : null;
}

/**
 * Fan-in Sankey from passport Kernfelder only (`materialComposition`, `materialZusammensetzung`).
 */
export function tryMaterialCompositionToSankeyFromRaw(
  raw: Record<string, unknown>,
  productLabel: string,
): CompositionGraphPayload | null {
  const rows = collectPassportCoreMaterialRowsForSankey(raw);
  return buildSankeyFromRows([...rows], productLabel);
}

/**
 * Builds a minimal fan-in Sankey (materials → product) from a `materialComposition` array only.
 */
export function tryMaterialCompositionToSankey(
  value: unknown,
  productLabel: string,
): CompositionGraphPayload | null {
  const rows = normalizeFlatMaterialArray(coerceMaterialCompositionArray(value));
  return buildSankeyFromRows(rows, productLabel);
}
