import { describe, expect, it } from 'vitest';
import {
  buildChemicalMassBalanceSegments,
  MASS_BALANCE_FILLER_LABEL,
  massBalanceSegmentsSumTo100,
} from '@/app/domain/dpp/chemicalMassBalance';

const HENKEL_LIKE_COMPOSITION = [
  {
    stoffname: 'Quarz (SiO2), <1% einatembar',
    prozentAnteil: '40 - 60 %',
  },
  {
    stoffname: 'Zement, Portland-, Chemikalien',
    prozentAnteil: '20 - 40 %',
  },
  {
    stoffname: 'Kalkhaltiges Sedimentgestein mit freiem Siliciumdioxid',
    prozentAnteil: '5 - < 10 %',
  },
  {
    stoffname: 'Kaminstaub, Portlandzement',
    prozentAnteil: '1 - < 5 %',
  },
];

describe('buildChemicalMassBalanceSegments', () => {
  it('closes mass balance gap with calculated filler segment', () => {
    const segments = buildChemicalMassBalanceSegments(HENKEL_LIKE_COMPOSITION);
    expect(segments).not.toBeNull();
    expect(massBalanceSegmentsSumTo100(segments!)).toBe(true);

    const filler = segments!.find((segment) => segment.isCalculatedFiller);
    expect(filler?.label).toBe(MASS_BALANCE_FILLER_LABEL);
    expect(filler?.sharePercent).toBeCloseTo(9.5, 1);

    expect(segments!.filter((segment) => !segment.isCalculatedFiller)).toHaveLength(4);
  });

  it('ignores hardcoded 100% filler rows and recalculates gap', () => {
    const segments = buildChemicalMassBalanceSegments([
      ...HENKEL_LIKE_COMPOSITION,
      {
        stoffname: 'Nicht deklarationspflichtige Stoffe / Füllstoffe',
        prozentAnteil: '100 %',
      },
    ]);

    expect(segments).not.toBeNull();
    expect(segments!.some((segment) => segment.isCalculatedFiller)).toBe(true);
    expect(massBalanceSegmentsSumTo100(segments!)).toBe(true);
  });

  it('scales down when declared sum exceeds 100%', () => {
    const segments = buildChemicalMassBalanceSegments([
      { stoffname: 'Stoff A', prozentAnteil: '60 %' },
      { stoffname: 'Stoff B', prozentAnteil: '70 %' },
    ]);

    expect(segments).not.toBeNull();
    expect(segments!.some((segment) => segment.isCalculatedFiller)).toBe(false);
    expect(massBalanceSegmentsSumTo100(segments!)).toBe(true);
    expect(segments![0]?.sharePercent).toBeCloseTo(46.2, 1);
    expect(segments![1]?.sharePercent).toBeCloseTo(53.8, 1);
  });

  it('returns null when no parseable composition exists', () => {
    expect(buildChemicalMassBalanceSegments([])).toBeNull();
    expect(buildChemicalMassBalanceSegments(null)).toBeNull();
  });
});
