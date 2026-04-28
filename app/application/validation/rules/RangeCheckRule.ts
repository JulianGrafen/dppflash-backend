import type {
  DppValidationRule,
  GuardedDppPayload,
  ValidationMessage,
} from '@/app/application/validation/DppValidationTypes';

function isPercentage(value: number): boolean {
  return value >= 0 && value <= 100;
}

export class RangeCheckRule implements DppValidationRule {
  readonly name = 'RangeCheckRule';

  validate(dpp: GuardedDppPayload): readonly ValidationMessage[] {
    const materialErrors = dpp.composition
      .filter((material) => !isPercentage(material.percentage))
      .map((material): ValidationMessage => ({
        code: 'DPP_MATERIAL_PERCENTAGE_OUT_OF_RANGE',
        path: 'composition.percentage',
        message: `Material "${material.name}" has percentage outside [0, 100].`,
      }));

    const substanceErrors = dpp.substancesOfConcern
      .filter((substance) => !isPercentage(substance.concentration))
      .map((substance): ValidationMessage => ({
        code: 'DPP_SUBSTANCE_CONCENTRATION_OUT_OF_RANGE',
        path: 'substancesOfConcern.concentration',
        message: `Substance "${substance.name}" has concentration outside [0, 100].`,
      }));

    const carbonFootprint = dpp.environmentalImpact.carbonFootprint;
    const carbonErrors: ValidationMessage[] = carbonFootprint !== undefined && carbonFootprint < 0
      ? [{
          code: 'DPP_NEGATIVE_CARBON_FOOTPRINT',
          path: 'environmentalImpact.carbonFootprint',
          message: 'Carbon footprint must not be negative.',
        }]
      : [];

    return [...materialErrors, ...substanceErrors, ...carbonErrors];
  }
}
