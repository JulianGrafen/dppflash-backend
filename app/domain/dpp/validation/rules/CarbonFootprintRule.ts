import type { DppProductPassport } from '@/app/domain/dpp/dppSchema';
import type {
  DppValidationRule,
  ValidationFinding,
} from '@/app/domain/dpp/validation/DppValidationTypes';

export class CarbonFootprintRule implements DppValidationRule {
  readonly name = 'CarbonFootprintRule';

  validate(dpp: DppProductPassport): readonly ValidationFinding[] {
    const value = dpp.carbonFootprint.valueKgCo2e;

    if (Number.isFinite(value) && value >= 0) {
      return [];
    }

    return [{
      severity: 'error',
      code: 'DPP_NEGATIVE_CARBON_FOOTPRINT',
      field: 'carbonFootprint.valueKgCo2e',
      message: 'Carbon footprint must be a non-negative kg CO2e value.',
    }];
  }
}
