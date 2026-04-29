import { describe, expect, it } from 'vitest';

import { DppSchemaVersion, getRecyclingInstructionsByEwcCode } from '@/app/domain/models/DppModel';
import { DppValidationService } from '@/app/application/validation/DppValidationService';

function createValidPayload() {
  return {
    schemaVersion: DppSchemaVersion.EsprV1,
    identification: {
      upi: 'DE-HEN-992834-UF5000-B2',
      gtin: '4005800012345',
      batchNumber: 'BATCH-2026-04',
      taricCode: '35069100',
    },
    manufacturer: {
      name: 'Henkel',
      address: 'Duesseldorf, Germany',
      vatId: 'DE123456789',
    },
    composition: [
      { name: 'Epoxidharz', percentage: 65, isRecycled: false },
      { name: 'Aluminiumoxid', percentage: 35, isRecycled: false },
    ],
    substancesOfConcern: [],
    environmentalImpact: {
      carbonFootprint: 10,
    },
    circularity: {
      shelfLifeInMonths: 12,
      ewcCode: '08 04 09*',
      disposalInstructions: 'Nur ueber zugelassene Entsorgungswege entsorgen.',
    },
  };
}

describe('application DppValidationService', () => {
  it('returns warning and required action when carbon footprint is missing', () => {
    const service = new DppValidationService();
    const payload = createValidPayload();

    const report = service.validate({
      ...payload,
      environmentalImpact: {},
    });

    expect(report.status).toBe('WARNING');
    expect(report.warnings.some((warning) => warning.code === 'DPP_MISSING_CARBON_FOOTPRINT')).toBe(true);
    expect(report.requiredActions.some((action) => action.includes('Carbon footprint is missing'))).toBe(true);
  });

  it('returns failed when mandatory compliance gaps include missing upi and composition', () => {
    const service = new DppValidationService();
    const payload = createValidPayload();

    const report = service.validate({
      ...payload,
      identification: {
        ...payload.identification,
        upi: '',
      },
      composition: [],
    });

    expect(report.status).toBe('FAILED');
    expect(report.complianceGaps).toContain('identification.upi');
    expect(report.complianceGaps).toContain('composition');
    expect(report.requiredActions.some((action) => action.includes('identification.upi'))).toBe(true);
  });

  it('adds hazardous waste recycling guidance from starred EWC code', () => {
    const service = new DppValidationService();

    const report = service.validate(createValidPayload());

    expect(report.warnings.some((warning) => warning.code === 'DPP_RECYCLING_GUIDANCE')).toBe(true);
    expect(report.requiredActions.some((action) => action.includes('Gefaehrlicher Abfall'))).toBe(true);
  });
});

describe('getRecyclingInstructionsByEwcCode', () => {
  it('adds hazardous waste note for starred codes', () => {
    const instructions = getRecyclingInstructionsByEwcCode('08 04 09*');

    expect(instructions).toContain('Gefaehrlicher Abfall');
  });
});
