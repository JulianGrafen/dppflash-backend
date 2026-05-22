import { parseChemicalConcentrationBandMidpoint } from '@/app/domain/dpp/materialCompositionToSankey';

/** **Label** für mathematisch geschlossene Massenbilanz-Lücke (SDS Abschnitt 3). */
export const MASS_BALANCE_FILLER_LABEL = 'Nicht deklarationspflichtige Stoffe / Füllstoffe';

export type MassBalanceSegment = {
  readonly id: string;
  readonly label: string;
  readonly sharePercent: number;
  readonly isCalculatedFiller: boolean;
  readonly sourceConcentration?: string;
};

function unwrapPassportValue(value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value) && 'value' in value) {
    return (value as Record<string, unknown>).value;
  }
  return value;
}

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

function sdsSubstanceNameFromRow(row: Record<string, unknown>): string {
  for (const key of ['stoffname', 'substance', 'name', 'material', 'bezeichnung'] as const) {
    const v = row[key];
    if (typeof v === 'string' && v.trim()) {
      return v.trim();
    }
  }
  return '';
}

function concentrationTextFromRow(row: Record<string, unknown>): string {
  if (typeof row.prozentAnteil === 'string' && row.prozentAnteil.trim()) {
    return row.prozentAnteil.trim();
  }
  if (typeof row.prozentanteil === 'string' && row.prozentanteil.trim()) {
    return row.prozentanteil.trim();
  }
  if (typeof row.concentration === 'string' && row.concentration.trim()) {
    return row.concentration.trim();
  }
  if (typeof row.concentrationPercent === 'number' && Number.isFinite(row.concentrationPercent)) {
    return String(row.concentrationPercent);
  }
  if (typeof row.concentrationPercent === 'string' && row.concentrationPercent.trim()) {
    return row.concentrationPercent.trim();
  }
  return '';
}

function isExtractedSyntheticFillerName(name: string): boolean {
  const lower = name.trim().toLowerCase();
  return /nicht\s+deklarationspflichtig/.test(lower)
    || /^sonstige\s+bestandteile\b/.test(lower)
    || /^restanteil\b/.test(lower)
    || /\bf(ü|ue)llstoffe?\b/.test(lower);
}

function slugifyLabel(label: string, index: number): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return base ? `${base}-${index}` : `segment-${index}`;
}

function roundShare(value: number): number {
  return Math.round(value * 10) / 10;
}

/** **Normalisiert** Segmentanteile auf exakt 100 % (Rundungskorrektur am letzten Segment). */
function normalizeSegmentSharesTo100(segments: MassBalanceSegment[]): MassBalanceSegment[] {
  if (segments.length === 0) {
    return segments;
  }

  const rounded = segments.map((segment) => ({
    ...segment,
    sharePercent: roundShare(segment.sharePercent),
  }));

  const sum = rounded.reduce((acc, segment) => acc + segment.sharePercent, 0);
  const delta = roundShare(100 - sum);
  if (Math.abs(delta) < 0.05) {
    return rounded;
  }

  const lastIndex = rounded.length - 1;
  const last = rounded[lastIndex]!;
  return [
    ...rounded.slice(0, lastIndex),
    {
      ...last,
      sharePercent: roundShare(Math.max(0, last.sharePercent + delta)),
    },
  ];
}

/**
 * **Massenbilanz-Calculator** — Mittelwerte aus Konzentrationsbändern, Lücke → Füllstoff,
 * Überlauf (>100 %) → proportionale Skalierung ohne Füllstoff.
 */
export function buildChemicalMassBalanceSegments(
  chemicalComposition: unknown,
): readonly MassBalanceSegment[] | null {
  const preliminary: Array<{
    label: string;
    sharePercent: number;
    sourceConcentration?: string;
  }> = [];

  for (const item of coerceChemicalCompositionArray(chemicalComposition)) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      continue;
    }
    const row = item as Record<string, unknown>;
    const label = sdsSubstanceNameFromRow(row);
    if (!label || isExtractedSyntheticFillerName(label)) {
      continue;
    }

    const sourceConcentration = concentrationTextFromRow(row);
    const midpoint = parseChemicalConcentrationBandMidpoint(sourceConcentration);
    if (midpoint === null || midpoint <= 0) {
      continue;
    }

    preliminary.push({
      label,
      sharePercent: midpoint,
      sourceConcentration: sourceConcentration || undefined,
    });
  }

  if (preliminary.length === 0) {
    return null;
  }

  const rawSum = preliminary.reduce((acc, row) => acc + row.sharePercent, 0);
  let segments: MassBalanceSegment[];

  if (rawSum > 100) {
    const scale = 100 / rawSum;
    segments = preliminary.map((row, index) => ({
      id: slugifyLabel(row.label, index),
      label: row.label,
      sharePercent: row.sharePercent * scale,
      isCalculatedFiller: false,
      sourceConcentration: row.sourceConcentration,
    }));
  } else {
    segments = preliminary.map((row, index) => ({
      id: slugifyLabel(row.label, index),
      label: row.label,
      sharePercent: row.sharePercent,
      isCalculatedFiller: false,
      sourceConcentration: row.sourceConcentration,
    }));

    const gap = 100 - rawSum;
    if (gap > 0.05) {
      segments.push({
        id: 'calculated-filler',
        label: MASS_BALANCE_FILLER_LABEL,
        sharePercent: gap,
        isCalculatedFiller: true,
      });
    }
  }

  return normalizeSegmentSharesTo100(segments);
}

export function massBalanceSegmentsSumTo100(segments: readonly MassBalanceSegment[]): boolean {
  const sum = segments.reduce((acc, segment) => acc + segment.sharePercent, 0);
  return Math.abs(sum - 100) < 0.11;
}
