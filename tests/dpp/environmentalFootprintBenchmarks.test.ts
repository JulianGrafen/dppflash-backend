import { describe, expect, it } from 'vitest';
import {
  CO2_BENCHMARK_DISPLAY,
  COMPOSITION_ESTIMATE_BADGE,
  COMPOSITION_ESTIMATE_TOOLTIP,
  PROXY_BENCHMARK_BADGE,
  resolveCo2FootprintDisplay,
  resolveWaterFootprintDisplay,
  WATER_BENCHMARK_DISPLAY,
} from '@/app/domain/dpp/environmentalFootprintBenchmarks';

const HENKEL_LIKE_COMPOSITION = [
  { stoffname: 'Quarz (SiO2)', prozentAnteil: '40-60 %' },
  { stoffname: 'Zement, Portland', prozentAnteil: '20-40 %' },
  { stoffname: 'Kalkhaltiges Sedimentgestein', prozentAnteil: '5-<10 %' },
  { stoffname: 'Kaminstaub', prozentAnteil: '1-<5 %' },
];

describe('resolveCo2FootprintDisplay', () => {
  it('uses industry proxy when CO₂ is missing and no composition is available', () => {
    expect(resolveCo2FootprintDisplay({}, {})).toEqual({
      display: CO2_BENCHMARK_DISPLAY,
      estimateKind: 'industry_benchmark',
      badge: PROXY_BENCHMARK_BADGE,
      tooltip: expect.any(String),
    });
  });

  it('keeps verified LCA values without estimate badge', () => {
    expect(
      resolveCo2FootprintDisplay(
        { carbonFootprint: { valueKgCo2e: 12.5 } },
        {},
      ),
    ).toEqual({
      display: '12,5 kg CO₂e',
      estimateKind: 'verified',
    });
  });

  it('prefers stoffspezifische Schätzung from chemicalComposition', () => {
    const result = resolveCo2FootprintDisplay(
      { chemicalComposition: HENKEL_LIKE_COMPOSITION },
      {},
    );
    expect(result.estimateKind).toBe('composition');
    expect(result.badge).toBe(COMPOSITION_ESTIMATE_BADGE);
    expect(result.tooltip).toBe(COMPOSITION_ESTIMATE_TOOLTIP);
    expect(result.display).toContain('kg CO₂e / kg');
  });

  it('uses persisted estimatedCo2 when present', () => {
    expect(
      resolveCo2FootprintDisplay(
        { estimatedCo2: 0.45, estimatedWater: 1.2, chemicalComposition: HENKEL_LIKE_COMPOSITION },
        {},
      ),
    ).toEqual({
      display: '0,45 kg CO₂e / kg',
      estimateKind: 'composition',
      badge: COMPOSITION_ESTIMATE_BADGE,
      tooltip: COMPOSITION_ESTIMATE_TOOLTIP,
    });
  });
});

describe('resolveWaterFootprintDisplay', () => {
  it('uses process-water proxy when no composition is available', () => {
    expect(resolveWaterFootprintDisplay({})).toEqual({
      display: WATER_BENCHMARK_DISPLAY,
      estimateKind: 'industry_benchmark',
      badge: PROXY_BENCHMARK_BADGE,
      tooltip: expect.any(String),
    });
  });

  it('prefers stoffspezifische Schätzung over zero liters', () => {
    const result = resolveWaterFootprintDisplay({
      environmentalImpact: { waterFootprintLiters: 0 },
      chemicalComposition: HENKEL_LIKE_COMPOSITION,
    });
    expect(result.estimateKind).toBe('composition');
    expect(result.display).toContain('l / kg');
  });

  it('keeps positive measured water footprint', () => {
    expect(
      resolveWaterFootprintDisplay({ environmentalImpact: { waterFootprintLiters: 3.5 } }),
    ).toEqual({
      display: '3,5 l',
      estimateKind: 'verified',
    });
  });
});
