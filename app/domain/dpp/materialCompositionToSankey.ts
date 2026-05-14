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

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
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
  const candidates = ['material', 'name', 'component', 'substance', 'title'] as const;
  for (const k of candidates) {
    const v = row[k];
    if (typeof v === 'string' && v.trim()) {
      return v.trim();
    }
  }
  return '';
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
    const pct = parseMaterialPercentageLike(r.percentage);
    rows.push({ material, percentage: pct });
  }
  return rows;
}

function rowsFromRegulatoryExtraction(regulatory: unknown): { readonly material: string; readonly percentage: number }[] {
  if (!isRecord(regulatory)) {
    return [];
  }
  const mcs = regulatory.materialCompositionAndSubstances;
  if (!isRecord(mcs)) {
    return [];
  }
  const materials = mcs.materials;
  if (!Array.isArray(materials)) {
    return [];
  }

  const rows: { material: string; percentage: number }[] = [];
  for (const row of materials) {
    if (!row || typeof row !== 'object') {
      continue;
    }
    const r = row as Record<string, unknown>;
    const nameObj = r.name;
    const shareObj = r.sharePercent;
    const name =
      isRecord(nameObj) && typeof nameObj.value === 'string' ? nameObj.value.trim() : '';
    const pct =
      isRecord(shareObj) && typeof shareObj.value === 'number' && Number.isFinite(shareObj.value)
        ? Math.max(0, shareObj.value)
        : isRecord(shareObj)
          ? parseMaterialPercentageLike(shareObj.value)
          : 0;
    if (!name) {
      continue;
    }
    rows.push({ material: name, percentage: pct });
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
    }
  }
  return rows;
}

function rowsFromChemicalComposition(value: unknown): { readonly material: string; readonly percentage: number }[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const rows: { material: string; percentage: number }[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const r = entry as Record<string, unknown>;
    const substance = typeof r.substance === 'string' ? r.substance.trim() : '';
    if (!substance) {
      continue;
    }
    const pct = parseMaterialPercentageLike(r.concentrationPercent);
    rows.push({ material: substance, percentage: pct });
  }
  return rows;
}

/**
 * Collects material rows from passport root `materialComposition` or nested regulatory extraction.
 */
export function collectMaterialRowsForSankey(
  raw: Record<string, unknown>,
): ReadonlyArray<{ readonly material: string; readonly percentage: number }> {
  const fromFlat = normalizeFlatMaterialArray(raw.materialComposition);
  if (fromFlat.length > 0) {
    return fromFlat;
  }
  const fromReg = rowsFromRegulatoryExtraction(raw.regulatoryExtraction);
  if (fromReg.length > 0) {
    return fromReg;
  }
  if (typeof raw.materialZusammensetzung === 'string' && raw.materialZusammensetzung.trim()) {
    const fromMz = rowsFromMaterialZusammensetzungString(raw.materialZusammensetzung);
    if (fromMz.length > 0) {
      return fromMz;
    }
  }
  return rowsFromChemicalComposition(raw.chemicalComposition);
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
  const weights =
    sumPct > 0
      ? rows.map((r) => (r.percentage / sumPct) * 100)
      : rows.map(() => 100 / rows.length);

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
    value: Math.max(0.01, weights[i] ?? 0),
  }));

  const parsed = compositionGraphSchema.safeParse({ nodes, links });
  return parsed.success ? parsed.data : null;
}

/**
 * Prefers passport + regulatory material sources for the fallback Sankey.
 */
export function tryMaterialCompositionToSankeyFromRaw(
  raw: Record<string, unknown>,
  productLabel: string,
): CompositionGraphPayload | null {
  const rows = collectMaterialRowsForSankey(raw);
  return buildSankeyFromRows([...rows], productLabel);
}

/**
 * Builds a minimal fan-in Sankey (materials → product) from a `materialComposition` array only.
 */
export function tryMaterialCompositionToSankey(
  value: unknown,
  productLabel: string,
): CompositionGraphPayload | null {
  const rows = normalizeFlatMaterialArray(value);
  return buildSankeyFromRows(rows, productLabel);
}
