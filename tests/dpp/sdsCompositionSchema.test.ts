import { describe, expect, it } from 'vitest';
import {
  approximateMassPercentMidpoint,
  isSdsCompositionMassSumPlausible,
  sumApproximateMassPercents,
} from '@/app/domain/rag/sdsCompositionSchema';

describe('sdsCompositionSchema mass-% helpers', () => {
  it('sums midpoints across ranges and singles toward ~100', () => {
    const rows = [
      { stoffname: 'A', casNummer: null, prozentAnteil: '40 – 60 %', einstufung: null },
      { stoffname: 'B', casNummer: null, prozentAnteil: '50%', einstufung: null },
    ];
    expect(approximateMassPercentMidpoint('40 – 60 %')).toBeCloseTo(50, 5);
    expect(sumApproximateMassPercents(rows)).toBeCloseTo(100, 5);
    expect(isSdsCompositionMassSumPlausible(rows)).toBe(true);
  });

  it('accepts plausible SDS totals within tolerance', () => {
    const rows = [
      { stoffname: 'X', casNummer: null, prozentAnteil: '≥ 98 %', einstufung: null },
      { stoffname: 'Y', casNummer: null, prozentAnteil: '< 2 %', einstufung: null },
    ];
    expect(sumApproximateMassPercents(rows)).toBeCloseTo(99, 5);
    expect(isSdsCompositionMassSumPlausible(rows)).toBe(true);
  });
});
