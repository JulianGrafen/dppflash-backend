import { describe, expect, it } from 'vitest';
import {
  calculateEstimatedFootprintsFromComposition,
  EMISSION_FACTORS,
  matchEmissionFactorForSubstance,
} from '@/app/domain/dpp/chemicalCompositionFootprintCalculator';

const HENKEL_LIKE_COMPOSITION = [
  {
    stoffname: 'Quarz (SiO2)',
    casNummer: '14808-60-7',
    prozentAnteil: '40-60 %',
  },
  {
    stoffname: 'Zement, Portland',
    casNummer: '65997-15-1',
    prozentAnteil: '20-40 %',
  },
  {
    stoffname: 'Kalkhaltiges Sedimentgestein',
    casNummer: '-',
    prozentAnteil: '5-<10 %',
  },
  {
    stoffname: 'Kaminstaub',
    casNummer: '68475-76-3',
    prozentAnteil: '1-<5 %',
  },
];

describe('matchEmissionFactorForSubstance', () => {
  it('matches Portland cement and quartz aliases', () => {
    expect(matchEmissionFactorForSubstance('Zement, Portland')).toEqual(
      EMISSION_FACTORS['Zement, Portland-, Chemikalien'],
    );
    expect(matchEmissionFactorForSubstance('Quarz (SiO2)')).toEqual(
      EMISSION_FACTORS['Quarz (SiO2), <1% einatembar'],
    );
  });

  it('falls back to DEFAULT_FILLER for unknown substances', () => {
    expect(matchEmissionFactorForSubstance('Unbekannter Polymer')).toEqual(
      EMISSION_FACTORS.DEFAULT_FILLER,
    );
  });
});

describe('calculateEstimatedFootprintsFromComposition', () => {
  it('computes stoffspezifische Schätzwerte and closes mass balance with DEFAULT_FILLER', () => {
    const result = calculateEstimatedFootprintsFromComposition(HENKEL_LIKE_COMPOSITION);
    expect(result).not.toBeNull();

    // Midpoints: 50% + 30% + 7.5% + 3% = 90.5%; gap 9.5% filled with DEFAULT_FILLER
    const expectedCo2 =
      0.5 * 0.02
      + 0.3 * 0.85
      + 0.075 * 0.05
      + 0.03 * 0.15
      + 0.095 * 0.08;
    const expectedWater =
      0.5 * 0.3
      + 0.3 * 2.0
      + 0.075 * 0.5
      + 0.03 * 0.8
      + 0.095 * 0.4;

    expect(result!.estimatedCo2).toBeCloseTo(Math.round(expectedCo2 * 100) / 100, 5);
    expect(result!.estimatedWater).toBeCloseTo(Math.round(expectedWater * 10) / 10, 5);
  });

  it('ignores synthetic filler rows and lets DEFAULT_FILLER close the gap', () => {
    const result = calculateEstimatedFootprintsFromComposition([
      ...HENKEL_LIKE_COMPOSITION,
      {
        stoffname: 'Nicht deklarationspflichtige Stoffe / Füllstoffe',
        prozentAnteil: '12 %',
      },
    ]);
    expect(result).not.toBeNull();
    expect(result!.estimatedCo2).toBeGreaterThan(0);
  });

  it('returns null when no parseable composition rows exist', () => {
    expect(calculateEstimatedFootprintsFromComposition([])).toBeNull();
    expect(calculateEstimatedFootprintsFromComposition(null)).toBeNull();
  });
});
