import type { EsprProductData } from '@/app/types/espr';

/** **Branchen-Benchmark** für zementäre Trockenmörtel/Klebstoffe (kg CO₂e pro kg Produkt). */
export const DRY_MORTAR_CO2_BENCHMARK_KG_PER_KG = 0.38;

/** **Prozesswasser-Schätzwert** für modifizierte Trockenmörtel (Liter pro kg Produkt). */
export const DRY_MORTAR_WATER_BENCHMARK_L_PER_KG = 4.2;

/** **UI-Text** für den CO₂-Proxy laut ESPR-Kennzeichnungspflicht. */
export const CO2_BENCHMARK_DISPLAY = 'ca. 0,38 kg CO₂e pro kg';

/** **UI-Text** für den Wasserfußabdruck-Proxy. */
export const WATER_BENCHMARK_DISPLAY = 'ca. 4,2 l pro kg';

/** **Badge-Label** für generische Schätzwerte ohne produktspezifisches LCA. */
export const PROXY_BENCHMARK_BADGE = '⚠️ Schätzung (Branchen-Benchmark)';

/** **Tooltip** — transparenter Hinweis auf europäische Branchendurchschnittsdaten. */
export const PROXY_BENCHMARK_TOOLTIP =
  'Hierbei handelt es sich um einen mathematisch ermittelten Proxy-Wert basierend auf europäischen Durchschnittsdaten für modifizierte Trockenmörtel. Ein produktspezifisches LCA ist in Vorbereitung.';

export type FootprintMetricDisplay = {
  readonly display: string;
  readonly isProxyBenchmark: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function formatKgCo2e(value: number, maximumFractionDigits: number): string {
  return value.toLocaleString('de-DE', { maximumFractionDigits });
}

/**
 * **CO₂-Fußabdruck**: produktspezifische LCA-Werte haben Vorrang; sonst **Branchen-Benchmark**.
 * Null, 0 und fehlende Werte gelten als „In Berechnung“ und lösen den Proxy aus.
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
      isProxyBenchmark: false,
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
      isProxyBenchmark: false,
    };
  }

  return {
    display: CO2_BENCHMARK_DISPLAY,
    isProxyBenchmark: true,
  };
}

/**
 * **Wasserfußabdruck**: nur strikt positive Messwerte gelten als produktspezifisch.
 * Fehlende Angaben und **0 l** werden durch den **Prozesswasser-Benchmark** ersetzt.
 */
export function resolveWaterFootprintDisplay(raw: Record<string, unknown>): FootprintMetricDisplay {
  const env = asRecord(raw.environmentalImpact);
  const liters = env ? asNumber(env.waterFootprintLiters) : undefined;

  if (liters !== undefined && liters > 0) {
    return {
      display: `${liters.toLocaleString('de-DE')} l`,
      isProxyBenchmark: false,
    };
  }

  return {
    display: WATER_BENCHMARK_DISPLAY,
    isProxyBenchmark: true,
  };
}
