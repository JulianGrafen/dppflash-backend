import type { DppProductPassport } from '@/app/domain/dpp/dppSchema';
import type {
  DppValidationRule,
  ValidationFinding,
} from '@/app/domain/dpp/validation/DppValidationTypes';

const MIN_SUBSTANCE_OF_CONCERN_PERCENTAGE = 0.1;

export class SubstanceOfConcernThresholdRule implements DppValidationRule {
  readonly name = 'SubstanceOfConcernThresholdRule';

  validate(dpp: DppProductPassport): readonly ValidationFinding[] {
    return dpp.substancesOfConcern
      .filter((substance) => (
        substance.concentrationPercent !== undefined
        && substance.concentrationPercent <= MIN_SUBSTANCE_OF_CONCERN_PERCENTAGE
      ))
      .map((substance): ValidationFinding => ({
        severity: 'warning',
        code: 'DPP_SUBSTANCE_OF_CONCERN_BELOW_THRESHOLD',
        field: 'substancesOfConcern.concentrationPercent',
        message: `Substance "${substance.name}" is marked as concerning but has concentration <= ${MIN_SUBSTANCE_OF_CONCERN_PERCENTAGE}%. Manual review required.`,
      }));
  }
}
