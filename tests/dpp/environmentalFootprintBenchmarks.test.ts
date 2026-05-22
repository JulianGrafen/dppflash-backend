import { describe, expect, it } from 'vitest';
import {
  CO2_BENCHMARK_DISPLAY,
  resolveCo2FootprintDisplay,
  resolveWaterFootprintDisplay,
  WATER_BENCHMARK_DISPLAY,
} from '@/app/domain/dpp/environmentalFootprintBenchmarks';

describe('resolveCo2FootprintDisplay', () => {
  it('uses industry proxy when CO₂ is missing or zero', () => {
    expect(
      resolveCo2FootprintDisplay({}, {}),
    ).toEqual({
      display: CO2_BENCHMARK_DISPLAY,
      isProxyBenchmark: true,
    });

    expect(
      resolveCo2FootprintDisplay(
        { carbonFootprint: { valueKgCo2e: 0 } },
        {},
      ),
    ).toEqual({
      display: CO2_BENCHMARK_DISPLAY,
      isProxyBenchmark: true,
    });
  });

  it('keeps verified LCA values without proxy badge', () => {
    expect(
      resolveCo2FootprintDisplay(
        { carbonFootprint: { valueKgCo2e: 12.5 } },
        {},
      ),
    ).toEqual({
      display: '12,5 kg CO₂e',
      isProxyBenchmark: false,
    });

    expect(
      resolveCo2FootprintDisplay(
        {},
        { totalKg: 8, perKwhKg: 0.04 },
      ),
    ).toEqual({
      display: 'Gesamt 8 kg CO₂e · pro kWh 0,04 kg CO₂e',
      isProxyBenchmark: false,
    });
  });
});

describe('resolveWaterFootprintDisplay', () => {
  it('uses process-water proxy for missing or zero liters', () => {
    expect(resolveWaterFootprintDisplay({})).toEqual({
      display: WATER_BENCHMARK_DISPLAY,
      isProxyBenchmark: true,
    });

    expect(
      resolveWaterFootprintDisplay({ environmentalImpact: { waterFootprintLiters: 0 } }),
    ).toEqual({
      display: WATER_BENCHMARK_DISPLAY,
      isProxyBenchmark: true,
    });
  });

  it('keeps positive measured water footprint', () => {
    expect(
      resolveWaterFootprintDisplay({ environmentalImpact: { waterFootprintLiters: 3.5 } }),
    ).toEqual({
      display: '3,5 l',
      isProxyBenchmark: false,
    });
  });
});
