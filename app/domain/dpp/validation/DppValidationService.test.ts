import { describe, expect, it } from 'vitest';

import type { DppProductPassport } from '@/app/domain/dpp/dppSchema';
import { DPP_SCHEMA_VERSION } from '@/app/domain/dpp/dppSchema';
import { DppValidationService } from '@/app/domain/dpp/validation/DppValidationService';

function createValidPassport(overrides: Partial<DppProductPassport> = {}): DppProductPassport {
  return {
    schemaVersion: DPP_SCHEMA_VERSION,
    declaredProductType: 'Industriekleber',
    productName: 'UltraFix 5000',
    upi: 'DE-HEN-992834-UF5000-B2',
    gtin: '4005800012345',
    materialComposition: [
      { material: 'Epoxidharz', percentage: 65 },
      { material: 'Aluminiumoxid', percentage: 25 },
      { material: 'Reaktivverduenner', percentage: 10 },
    ],
    recycledContent: [
      { material: 'Aluminiumoxid', percentage: 25 },
    ],
    carbonFootprint: {
      valueKgCo2e: 0,
      lifecycleStage: '',
      calculationMethod: '',
    },
    substancesOfConcern: [
      {
        name: 'Bisphenol-A',
        casNumber: '80-05-7',
        concentrationPercent: 1.5,
        hazardClass: 'SVHC',
      },
    ],
    ...overrides,
  };
}

describe('DppValidationService', () => {
  it('accepts a passport with a material total of exactly 100%', () => {
    const service = new DppValidationService();

    const result = service.validate(createValidPassport());

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects material composition totals below 100%', () => {
    const service = new DppValidationService();

    const result = service.validate(createValidPassport({
      materialComposition: [
        { material: 'Epoxidharz', percentage: 60 },
        { material: 'Aluminiumoxid', percentage: 25 },
        { material: 'Reaktivverduenner', percentage: 10 },
      ],
    }));

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      'DPP_MATERIAL_TOTAL_NOT_100: Total material composition must equal exactly 100% (+/- 0.01 tolerance). Current total is 95.00%.',
    );
  });

  it('keeps substances of concern above the 1.5% threshold as a warning', () => {
    const service = new DppValidationService();

    const result = service.validate(createValidPassport({
      substancesOfConcern: [
        {
          name: 'Bisphenol-A',
          casNumber: '80-05-7',
          concentrationPercent: 65,
          hazardClass: 'SVHC',
        },
      ],
    }));

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toContain(
      'DPP_SUBSTANCE_OF_CONCERN_EXCEEDS_THRESHOLD: Substance "Bisphenol-A" exceeds the allowed threshold of 1.5%. Current concentration is 65.00%. Please review manually.',
    );
  });

  it('returns a warning when a waste code is not found in the mapping', () => {
    const service = new DppValidationService();

    const result = service.validate(createValidPassport({
      wasteCode: '99 99 99',
    }));

    expect(result.isValid).toBe(true);
    expect(result.warnings).toContain(
      'DPP_UNKNOWN_WASTE_CODE: Waste code "99 99 99" was not found in the configured mapping. Manual review by the specialist department is required.',
    );
  });
});
