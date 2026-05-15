import { z } from 'zod';

/**
 * Einzelne Komponente aus SDS Abschnitt 3 (Massen-% / Gew.-%).
 * `prozentAnteil` bleibt wörtlich wie im Dokument (inkl. Bereiche).
 */
export const sdsCompositionEntrySchema = z
  .object({
    stoffname: z.string().min(1),
    casNummer: z.string().nullable(),
    prozentAnteil: z.string(),
    einstufung: z.string().nullable(),
  })
  .strict();

export type SdsCompositionEntry = z.infer<typeof sdsCompositionEntrySchema>;

/** Mind. eine Komponente — Ingestion / Audit. */
export const sdsCompositionArraySchema = z.array(sdsCompositionEntrySchema).min(1);

/**
 * Grobe numerische Interpretation einer %-Zelle für Summenprüfung (Mitte bei Bereichen).
 * Keine Änderung der angezeigten Originalstrings — nur Diagnose.
 */
export function approximateMassPercentMidpoint(cell: string): number | null {
  const s = cell.replace(/\s+/g, ' ').trim();
  if (!s) {
    return null;
  }
  const norm = s.replace(/,/g, '.');
  const range = norm.match(
    /(\d+(?:\.\d+)?)\s*(?:-|–|—|bis)\s*(\d+(?:\.\d+)?)\s*%/i,
  );
  if (range) {
    const a = Number.parseFloat(range[1]);
    const b = Number.parseFloat(range[2]);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      return (a + b) / 2;
    }
  }
  const lt = norm.match(/<\s*(\d+(?:\.\d+)?)\s*%/i);
  if (lt) {
    const u = Number.parseFloat(lt[1]);
    return Number.isFinite(u) ? u / 2 : null;
  }
  const ge = norm.match(/(?:≥|>=)\s*(\d+(?:\.\d+)?)\s*%/i);
  if (ge) {
    const n = Number.parseFloat(ge[1]);
    return Number.isFinite(n) ? n : null;
  }
  const single = norm.match(/(\d+(?:\.\d+)?)\s*%/);
  if (single) {
    const n = Number.parseFloat(single[1]);
    return Number.isFinite(n) ? n : null;
  }
  const bare = norm.match(/^(\d+(?:\.\d+)?)\s*$/);
  if (bare) {
    const n = Number.parseFloat(bare[1]);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Summe der Mittelpunkts-Schätzungen; `null`, wenn keine Zelle parsbar ist. */
export function sumApproximateMassPercents(entries: readonly SdsCompositionEntry[]): number | null {
  let sum = 0;
  let count = 0;
  for (const row of entries) {
    const v = approximateMassPercentMidpoint(row.prozentAnteil);
    if (v === null) {
      continue;
    }
    sum += v;
    count += 1;
  }
  return count === 0 ? null : sum;
}

/** ±3 %-Punkte um 100 % gelten als plausibel (Bereiche, Rundung). */
export function isSdsCompositionMassSumPlausible(entries: readonly SdsCompositionEntry[]): boolean {
  const s = sumApproximateMassPercents(entries);
  if (s === null) {
    return true;
  }
  return Math.abs(s - 100) <= 3;
}
