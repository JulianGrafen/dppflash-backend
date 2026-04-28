import type { DppProductPassport } from '@/app/domain/dpp/dppSchema';
import type {
  DppValidationRule,
  ValidationFinding,
} from '@/app/domain/dpp/validation/DppValidationTypes';

function isValidPercentage(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

export class PercentageRangeRule implements DppValidationRule {
  readonly name = 'PercentageRangeRule';

  validate(dpp: DppProductPassport): readonly ValidationFinding[] {
    const materialFindings = dpp.materialComposition
      .filter((entry) => !isValidPercentage(entry.percentage))
      .map((entry): ValidationFinding => ({
        severity: 'error',
        code: 'DPP_INVALID_MATERIAL_PERCENTAGE',
        field: 'materialComposition.percentage',
        message: `Material percentage for "${entry.material}" must be between 0 and 100.`,
      }));

    const recycledFindings = dpp.recycledContent
      .filter((entry) => !isValidPercentage(entry.percentage))
      .map((entry): ValidationFinding => ({
        severity: 'error',
        code: 'DPP_INVALID_RECYCLED_PERCENTAGE',
        field: 'recycledContent.percentage',
        message: `Recycled content percentage for "${entry.material}" must be between 0 and 100.`,
      }));

    const substanceFindings = dpp.substancesOfConcern
      .filter((entry) => (
        entry.concentrationPercent !== undefined
        && !isValidPercentage(entry.concentrationPercent)
      ))
      .map((entry): ValidationFinding => ({
        severity: 'error',
        code: 'DPP_INVALID_SUBSTANCE_PERCENTAGE',
        field: 'substancesOfConcern.concentrationPercent',
        message: `Concentration for substance "${entry.name}" must be between 0 and 100.`,
      }));

    return [...materialFindings, ...recycledFindings, ...substanceFindings];
  }
}
