import type { EsprProductData } from '@/app/types/espr';
import { calculateEstimatedFootprintsFromComposition } from '@/app/domain/dpp/chemicalCompositionFootprintCalculator';

/** **Branchen-Benchmark** für zementäre Trockenmörtel/Klebstoffe (kg CO₂e pro kg Produkt). */
export const DRY_MORTAR_CO2_BENCHMARK_KG_PER_KG = 0.38;

/** **Prozesswasser-Schätzwert** für modifizierte Trockenmörtel (Liter pro kg Produkt). */
export const DRY_MORTAR_WATER_BENCHMARK_L_PER_KG = 4.2;

/** **UI-Text** für den statischen CO₂-Proxy. */
export const CO2_BENCHMARK_DISPLAY = 'ca. 0,38 kg CO₂e pro kg';

/** **UI-Text** für den statischen Wasser-Proxy. */
export const WATER_BENCHMARK_DISPLAY = 'ca. 4,2 l pro kg';

/** **Badge** für generischen Branchen-Proxy ohne Zusammensetzungsdaten. */
export const PROXY_BENCHMARK_BADGE = '⚠️ Schätzung (Branchen-Benchmark)';

/** **Badge** für stoffspezifische Software-Schätzung aus `chemicalComposition`. */
export const COMPOSITION_ESTIMATE_BADGE = '⚠️ Kalkulierte Schätzung (Stoffspezifisch)';

/** **Tooltip** für statischen Branchen-Benchmark. */
export const PROXY_BENCHMARK_TOOLTIP =
  'Hierbei handelt es sich um einen mathematisch ermittelten Proxy-Wert basierend auf europäischen Durchschnittsdaten für modifizierte Trockenmörtel. Ein produktspezifisches LCA ist in Vorbereitung.';

/** **Tooltip** für stoffspezifische Emissionsfaktor-Kalkulation. */
export const COMPOSITION_ESTIMATE_TOOLTIP =
  'Dieser Wert ist eine softwareseitige Annäherung. Er wird aus der prozentualen chemischen Zusammensetzung des SDBs und branchenüblichen Emissionsfaktoren (Ecoinvent Proxys) berechnet. Die fehlende Massenbilanz wurde durch neutrale Füllstoffe aufgefüllt. Ein echtes LCA liegt noch nicht vor.';

export type FootprintEstimateKind = 'verified' | 'composition' | 'industry_benchmark';

export type FootprintMetricDisplay = {
  readonly display: string;
  readonly estimateKind: FootprintEstimateKind;
  readonly badge?: string;
  readonly tooltip?: string;
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function formatPerKgCo2(value: number): string {
  return `${value.toLocaleString('de-DE', { maximumFractionDigits: 2 })} kg CO₂e / kg`;
}

function formatPerKgWater(value: number): string {
  return `${value.toLocaleString('de-DE', { maximumFractionDigits: 1 })} l / kg`;
}

function formatKgCo2e(value: number, maximumFractionDigits: number): string {
  return value.toLocaleString('de-DE', { maximumFractionDigits });
}

function resolveCompositionEstimates(
  raw: Record<string, unknown>,
): { readonly co2: number; readonly water: number } | null {
  const storedCo2 = asNumber(raw.estimatedCo2);
  const storedWater = asNumber(raw.estimatedWater);
  if (storedCo2 !== undefined && storedWater !== undefined && storedCo2 >= 0 && storedWater >= 0) {
    return { co2: storedCo2, water: storedWater };
  }

  const computed = calculateEstimatedFootprintsFromComposition(raw.chemicalComposition);
  if (!computed) {
    return null;
  }

  return {
    co2: computed.estimatedCo2,
    water: computed.estimatedWater,
  };
}

function compositionEstimateDisplay(co2: number, water: number): {
  readonly co2: FootprintMetricDisplay;
  readonly water: FootprintMetricDisplay;
} {
  return {
    co2: {
      display: formatPerKgCo2(co2),
      estimateKind: 'composition',
      badge: COMPOSITION_ESTIMATE_BADGE,
      tooltip: COMPOSITION_ESTIMATE_TOOLTIP,
    },
    water: {
      display: formatPerKgWater(water),
      estimateKind: 'composition',
      badge: COMPOSITION_ESTIMATE_BADGE,
      tooltip: COMPOSITION_ESTIMATE_TOOLTIP,
    },
  };
}

/**
 * **CO₂-Fußabdruck**: verifiziertes LCA → stoffspezifische Schätzung → Branchen-Benchmark.
 */
export function resolveCo2FootprintDisplay(
  raw: Record<string, unknown>,
  carbonFootprint: EsprProductData['carbonFootprint'],
): FootprintMetricDisplay {
  const cf = asRecord(raw.carbonFootprint);
  const valueKgCo2e = cf ? asNumber(cf.valueKgCo2e) : undefined;
  if (valueKgCo2e !== undefined && valueKgCo2e > 0) {
    return {
      display: `${formatKgCo2e(valueKgCo2e, 2)} kg CO₂e`,
      estimateKind: 'verified',
    };
  }

  const parts: string[] = [];
  if (carbonFootprint.totalKg !== undefined && carbonFootprint.totalKg > 0) {
    parts.push(`Gesamt ${formatKgCo2e(carbonFootprint.totalKg, 2)} kg CO₂e`);
  }
  if (carbonFootprint.perKwhKg !== undefined && carbonFootprint.perKwhKg > 0) {
    parts.push(`pro kWh ${formatKgCo2e(carbonFootprint.perKwhKg, 3)} kg CO₂e`);
  }
  if (parts.length > 0) {
    return {
      display: parts.join(' · '),
      estimateKind: 'verified',
    };
  }

  const compositionEstimates = resolveCompositionEstimates(raw);
  if (compositionEstimates) {
    return compositionEstimateDisplay(compositionEstimates.co2, compositionEstimates.water).co2;
  }

  return {
    display: CO2_BENCHMARK_DISPLAY,
    estimateKind: 'industry_benchmark',
    badge: PROXY_BENCHMARK_BADGE,
    tooltip: PROXY_BENCHMARK_TOOLTIP,
  };
}

/**
 * **Wasserfußabdruck**: verifizierte Messwerte → stoffspezifische Schätzung → Branchen-Benchmark.
 */
export function resolveWaterFootprintDisplay(raw: Record<string, unknown>): FootprintMetricDisplay {
  const env = asRecord(raw.environmentalImpact);
  const liters = env ? asNumber(env.waterFootprintLiters) : undefined;

  if (liters !== undefined && liters > 0) {
    return {
      display: `${liters.toLocaleString('de-DE')} l`,
      estimateKind: 'verified',
    };
  }

  const compositionEstimates = resolveCompositionEstimates(raw);
  if (compositionEstimates) {
    return compositionEstimateDisplay(compositionEstimates.co2, compositionEstimates.water).water;
  }

  return {
    display: WATER_BENCHMARK_DISPLAY,
    estimateKind: 'industry_benchmark',
    badge: PROXY_BENCHMARK_BADGE,
    tooltip: PROXY_BENCHMARK_TOOLTIP,
  };
}
