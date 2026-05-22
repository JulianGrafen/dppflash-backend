import {
  compositionGraphSchema,
  type CompositionGraphPayload,
} from '@/app/domain/dpp/dppExtractionZodSchema';

function unwrapPassportValue(value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value) && 'value' in value) {
    return (value as Record<string, unknown>).value;
  }
  return value;
}

/**
 * Mittelwert eines angegebenen Konzentrationsbereichs (SDS/chemische Zusammensetzung), z. B.:
 * `40-60 %`, `5-<10 %`, `1-<5 %`, `<1 %`.
 * Leer bzw. nur `–` → `null`.
 */
export function parseChemicalConcentrationBandMidpoint(text: string): number | null {
  let s = text
    .replace(/\u00a0/g, ' ')
    .replace(/٫/g, '.')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s || s === '-' || s === '—' || s.toLowerCase() === 'n/a') {
    return null;
  }
  s = s.replace(/%/g, '').trim();

  const parseN = (x: string): number | null => {
    const n = Number(x.replace(/\s+/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };

  const ltBand = s.match(/^(\d+(?:[.,]\d+)?)\s*[-–]?\s*<\s*(\d+(?:[.,]\d+)?)$/);
  if (ltBand) {
    const a = parseN(ltBand[1] ?? '');
    const b = parseN(ltBand[2] ?? '');
    if (a !== null && b !== null) {
      return (a + b) / 2;
    }
  }

  const dashBand = s.match(/^(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)$/);
  if (dashBand) {
    const a = parseN(dashBand[1] ?? '');
    const b = parseN(dashBand[2] ?? '');
    if (a !== null && b !== null) {
      return (a + b) / 2;
    }
  }

  const ltOnly = s.match(/^<\s*(\d+(?:[.,]\d+)?)$/);
  if (ltOnly) {
    const u = parseN(ltOnly[1] ?? '');
    if (u !== null) {
      return u / 2;
    }
  }

  const cleaned = s.replace(/^≥\s*/i, '').replace(/^≤\s*/i, '').replace(/^~\s*/, '');
  const single = parseN(cleaned);
  if (single !== null && single >= 0) {
    return single;
  }

  return null;
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

  if (typeof mzInner === 'string' && mzInner.trim() && !mzInner.trim().startsWith('[')) {
    const fromMzWrappedText = rowsFromMaterialZusammensetzungString(mzInner.trim());
    if (fromMzWrappedText.length > 0) {
      return fromMzWrappedText;
    }
  }

  if (typeof raw.materialZusammensetzung === 'string' && raw.materialZusammensetzung.trim()) {
    const fromMz = rowsFromMaterialZusammensetzungString(raw.materialZusammensetzung);
    if (fromMz.length > 0) {
      return fromMz;
    }
  }
  return [];
}

function formatDeRoughPercentForSummary(n: number): string {
  if (Math.abs(n - Math.round(n)) < 0.051) {
    return `${Math.round(n)} %`;
  }
  return `${n.toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`;
}

/**
 * Material-Zusammensetzung als Freitext — gleiche Datenbasis wie Sankey/`collectPassportCoreMaterialRowsForSankey`.
 */
export function formatPassportCoreMaterialSummary(
  raw: Record<string, unknown>,
  options?: { readonly maxChars?: number },
): string | undefined {
  const maxChars = options?.maxChars ?? 480;
  const rows = [...collectPassportCoreMaterialRowsForSankey(raw)];
  if (rows.length === 0) {
    return undefined;
  }
  const parts = rows.map((r) =>
    r.percentage > 0.05 ? `${r.material} (${formatDeRoughPercentForSummary(r.percentage)})` : r.material,
  );
  let s = parts.join(', ');
  if (s.length > maxChars) {
    s = `${s.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
  }
  return s;
}

export function compositionGraphHasMeaningfulFlows(graph: CompositionGraphPayload): boolean {
  const total = graph.links.reduce((s, l) => s + l.value, 0);
  return total > 0.05;
}

/** **Sankey-Massenbilanz** — synthetische Lücke zu 100 % (SDB-typisch). */
export const NON_DECLARABLE_FILLER_LABEL = 'Nicht deklarationspflichtige Stoffe';

function isNonDeclarableFillerMaterialName(name: string): boolean {
  const lower = name.trim().toLowerCase();
  return /nicht\s+deklarationspflichtig/.test(lower)
    || /^sonstige\s+bestandteile\b/.test(lower)
    || /^restanteil\b/.test(lower)
    || /\bf(ü|ue)llstoffe?\b/.test(lower);
}

/**
 * **Massenbilanz** — behält deklarierte Mittelwerte bei und füllt fehlende Anteile mit
 * **Nicht deklarationspflichtige Stoffe** (Rest-%), statt proportional zu skalieren.
 */
export function closeSankeyRowsWithNonDeclarableFiller(
  rows: readonly { readonly material: string; readonly percentage: number }[],
): readonly { readonly material: string; readonly percentage: number }[] {
  if (rows.length === 0) {
    return [];
  }

  const declared: { material: string; percentage: number }[] = [];
  let existingFillerPct = 0;

  for (const row of rows) {
    const material = row.material.trim();
    if (!material) {
      continue;
    }
    const pct = Math.max(0, row.percentage);
    if (isNonDeclarableFillerMaterialName(material)) {
      existingFillerPct += pct;
      continue;
    }
    if (pct > 0) {
      declared.push({ material, percentage: pct });
    }
  }

  if (declared.length === 0 && existingFillerPct <= 0) {
    const valid = rows.map((r) => r.material.trim()).filter(Boolean);
    if (valid.length === 0) {
      return [];
    }
    return valid.map((material) => ({ material, percentage: 100 / valid.length }));
  }

  const declaredSum = declared.reduce((a, r) => a + r.percentage, 0);
  const result = [...declared];
  const gap = 100 - declaredSum - existingFillerPct;

  if (existingFillerPct > 0.05) {
    result.push({ material: NON_DECLARABLE_FILLER_LABEL, percentage: existingFillerPct });
  } else if (gap > 0.05) {
    result.push({ material: NON_DECLARABLE_FILLER_LABEL, percentage: gap });
  }

  return result;
}

function buildSankeyFromRows(
  rows: readonly { readonly material: string; readonly percentage: number }[],
  productLabel: string,
): CompositionGraphPayload | null {
  const balancedRows = closeSankeyRowsWithNonDeclarableFiller(rows);
  if (balancedRows.length === 0) {
    return null;
  }

  const linkValues = balancedRows.map((r) => Math.max(0.01, r.percentage));

  const productId = 'end_product';
  const endLabel = productLabel.trim().length > 0 ? productLabel.trim() : 'Produkt';

  const nodes = [
    ...balancedRows.map((r, i) => ({
      id: `mat_${i}`,
      label: r.material.trim(),
      category: 'raw_material' as const,
    })),
    {
      id: productId,
      label: endLabel,
      category: 'final_product' as const,
    },
  ];

  const links = balancedRows.map((_, i) => ({
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

/**
 * SDS-/REACH-Zeilen aus `chemicalComposition` → geschätzte Anteile (Mittelpunkt der Bänder) für Sankey-Gewichte.
 */
export function extractChemicalCompositionRowsForSankey(
  value: unknown,
): ReadonlyArray<{ readonly material: string; readonly percentage: number }> {
  let inner: unknown = unwrapPassportValue(value);
  if (typeof inner === 'string') {
    const t = inner.trim();
    if (t.startsWith('[')) {
      try {
        inner = JSON.parse(t) as unknown;
      } catch {
        return [];
      }
    } else {
      return [];
    }
  }
  if (!Array.isArray(inner) || inner.length === 0) {
    return [];
  }

  const preliminary: { material: string; percentage: number }[] = [];
  for (const item of inner) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      continue;
    }
    const o = item as Record<string, unknown>;
    const material = materialLabelFromRow(o);
    if (!material || isNonDeclarableFillerMaterialName(material)) {
      continue;
    }

    let concText = '';
    if (typeof o.prozentAnteil === 'string') {
      concText = o.prozentAnteil;
    } else if (typeof o.prozentanteil === 'string') {
      concText = o.prozentanteil;
    } else if (typeof o.concentration === 'string') {
      concText = o.concentration;
    } else if (typeof o.concentrationPercent === 'number' && Number.isFinite(o.concentrationPercent)) {
      concText = String(o.concentrationPercent);
    } else if (typeof o.concentrationPercent === 'string') {
      concText = o.concentrationPercent;
    }

    const mid = parseChemicalConcentrationBandMidpoint(concText.trim());
    preliminary.push({
      material,
      percentage: mid !== null && mid > 0 ? mid : 0,
    });
  }

  if (preliminary.length === 0) {
    return [];
  }

  const sumPct = preliminary.reduce((a, r) => a + r.percentage, 0);
  if (sumPct <= 0) {
    const n = preliminary.length;
    return preliminary.map((r) => ({ material: r.material, percentage: n > 0 ? 100 / n : 0 }));
  }

  return preliminary;
}

/**
 * Fan-in Sankey: Inhaltsstoffe → Produkt, Gewichtung aus Konzentrationsbereichen (Mittelwert).
 */
export function tryChemicalCompositionToSankey(
  value: unknown,
  productLabel: string,
): CompositionGraphPayload | null {
  const rows = extractChemicalCompositionRowsForSankey(value);
  if (rows.length === 0) {
    return null;
  }
  return buildSankeyFromRows([...rows], productLabel);
}

export type ChemicalIngredientListRow = {
  readonly name: string;
  readonly cas: string;
  readonly concentration: string;
  readonly classification: string;
};

function coerceChemicalCompositionArray(value: unknown): unknown[] {
  let inner: unknown = unwrapPassportValue(value);
  if (typeof inner === 'string') {
    const t = inner.trim();
    if (!t.startsWith('[')) {
      return [];
    }
    try {
      inner = JSON.parse(t) as unknown;
    } catch {
      return [];
    }
  }
  return Array.isArray(inner) ? inner : [];
}

function readConcentrationDisplayFromRow(o: Record<string, unknown>): string {
  if (typeof o.prozentAnteil === 'string' && o.prozentAnteil.trim()) {
    return o.prozentAnteil.trim();
  }
  if (typeof o.prozentanteil === 'string' && o.prozentanteil.trim()) {
    return o.prozentanteil.trim();
  }
  if (typeof o.concentration === 'string' && o.concentration.trim()) {
    return o.concentration.trim();
  }
  if (typeof o.concentrationPercent === 'number' && Number.isFinite(o.concentrationPercent)) {
    return `${o.concentrationPercent} %`;
  }
  if (typeof o.concentrationPercent === 'string' && o.concentrationPercent.trim()) {
    return o.concentrationPercent.trim();
  }
  return '–';
}

function isSyntheticFillerIngredientName(name: string): boolean {
  return isNonDeclarableFillerMaterialName(name);
}

/** SDS Abschnitt 3 — Inhaltsstoffe für Tabellen in Herkunft / Traceability. */
export function collectChemicalCompositionIngredientRows(
  value: unknown,
): ReadonlyArray<ChemicalIngredientListRow> {
  const rows: ChemicalIngredientListRow[] = [];
  for (const item of coerceChemicalCompositionArray(value)) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      continue;
    }
    const o = item as Record<string, unknown>;
    const name = materialLabelFromRow(o);
    if (!name || isSyntheticFillerIngredientName(name)) {
      continue;
    }

    const casRaw = o.casNummer ?? o.casNumber;
    const cas =
      casRaw !== null && casRaw !== undefined && String(casRaw).trim().length > 0
        ? String(casRaw).trim()
        : '–';

    let classification = '–';
    if (typeof o.einstufung === 'string' && o.einstufung.trim()) {
      classification = o.einstufung.trim();
    } else if (typeof o.function === 'string' && o.function.trim()) {
      classification = o.function.trim();
    }

    rows.push({
      name,
      cas,
      concentration: readConcentrationDisplayFromRow(o),
      classification,
    });
  }
  return rows;
}
