import { parseChemicalConcentrationBandMidpoint } from '@/app/domain/dpp/materialCompositionToSankey';

export type EmissionFactorPair = {
  readonly co2: number;
  readonly water: number;
};

/**
 * **Emissionsfaktoren-Lexikon** — Industrie-Durchschnittswerte pro 1 kg Stoff (Ecoinvent-Proxys).
 */
export const EMISSION_FACTORS: Record<string, EmissionFactorPair> = {
  'Zement, Portland-, Chemikalien': { co2: 0.85, water: 2.0 },
  'Quarz (SiO2), <1% einatembar': { co2: 0.02, water: 0.3 },
  'Kalkhaltiges Sedimentgestein mit freiem Siliciumdioxid': { co2: 0.05, water: 0.5 },
  'Kaminstaub, Portlandzement': { co2: 0.15, water: 0.8 },
  DEFAULT_FILLER: { co2: 0.08, water: 0.4 },
};

/** **Alias-Tokens** für fuzzy Matching von SDB-Stoffnamen auf Lexikon-Keys. */
const EMISSION_FACTOR_ALIASES: Readonly<Record<string, readonly string[]>> = {
  'Zement, Portland-, Chemikalien': ['zement', 'portland'],
  'Quarz (SiO2), <1% einatembar': ['quarz', 'sio2', 'siliciumdioxid', 'silicon dioxide'],
  'Kalkhaltiges Sedimentgestein mit freiem Siliciumdioxid': [
    'sedimentgestein',
    'kalkhaltig',
    'freiem siliciumdioxid',
  ],
  'Kaminstaub, Portlandzement': ['kaminstaub', 'flugasche'],
};

export type CompositionFootprintEstimate = {
  readonly estimatedCo2: number;
  readonly estimatedWater: number;
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

function substanceNameFromRow(row: Record<string, unknown>): string {
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

function isSyntheticFillerSubstanceName(name: string): boolean {
  const lower = name.trim().toLowerCase();
  return /nicht\s+deklarationspflichtig/.test(lower)
    || /^sonstige\s+bestandteile\b/.test(lower)
    || /^restanteil\b/.test(lower)
    || (/\bf(ü|ue)llstoffe?\b/.test(lower) && /\b100\s*%/.test(name));
}

/**
 * **Matching** — exakter Key, Teilstring oder Alias; sonst **DEFAULT_FILLER**.
 */
export function matchEmissionFactorForSubstance(substanceName: string): EmissionFactorPair {
  const norm = substanceName.trim().toLowerCase();
  if (!norm) {
    return EMISSION_FACTORS.DEFAULT_FILLER;
  }

  for (const [key, factors] of Object.entries(EMISSION_FACTORS)) {
    if (key === 'DEFAULT_FILLER') {
      continue;
    }
    const keyNorm = key.toLowerCase();
    if (norm === keyNorm || norm.includes(keyNorm) || keyNorm.includes(norm)) {
      return factors;
    }
  }

  for (const [key, aliases] of Object.entries(EMISSION_FACTOR_ALIASES)) {
    if (aliases.some((token) => norm.includes(token))) {
      return EMISSION_FACTORS[key] ?? EMISSION_FACTORS.DEFAULT_FILLER;
    }
  }

  return EMISSION_FACTORS.DEFAULT_FILLER;
}

function roundFootprint(value: number, fractionDigits: number): number {
  const factor = 10 ** fractionDigits;
  return Math.round(value * factor) / factor;
}

/**
 * **Calculator** — iteriert `chemicalComposition`, nutzt Band-Mittelwerte, schließt Massenbilanz mit **DEFAULT_FILLER**.
 */
export function calculateEstimatedFootprintsFromComposition(
  chemicalComposition: unknown,
): CompositionFootprintEstimate | null {
  const rows = coerceChemicalCompositionArray(chemicalComposition);
  if (rows.length === 0) {
    return null;
  }

  let totalCo2 = 0;
  let totalWater = 0;
  let sumFraction = 0;
  let usedRows = 0;

  for (const item of rows) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      continue;
    }
    const row = item as Record<string, unknown>;
    const substanceName = substanceNameFromRow(row);
    if (!substanceName || isSyntheticFillerSubstanceName(substanceName)) {
      continue;
    }

    const midpointPercent = parseChemicalConcentrationBandMidpoint(concentrationTextFromRow(row));
    if (midpointPercent === null || midpointPercent <= 0) {
      continue;
    }

    const fraction = midpointPercent / 100;
    const factors = matchEmissionFactorForSubstance(substanceName);
    totalCo2 += fraction * factors.co2;
    totalWater += fraction * factors.water;
    sumFraction += fraction;
    usedRows += 1;
  }

  if (usedRows === 0) {
    return null;
  }

  if (sumFraction < 1) {
    const gap = 1 - sumFraction;
    const filler = EMISSION_FACTORS.DEFAULT_FILLER;
    totalCo2 += gap * filler.co2;
    totalWater += gap * filler.water;
  }

  return {
    estimatedCo2: roundFootprint(totalCo2, 2),
    estimatedWater: roundFootprint(totalWater, 1),
  };
}
