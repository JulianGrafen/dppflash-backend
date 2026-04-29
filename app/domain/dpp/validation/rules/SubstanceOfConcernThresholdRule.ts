import type { DppProductPassport } from '@/app/domain/dpp/dppSchema';
import type {
  DppValidationRule,
  ValidationFinding,
} from '@/app/domain/dpp/validation/DppValidationTypes';

const MAX_SUBSTANCE_OF_CONCERN_PERCENTAGE = 1.5;

export class SubstanceOfConcernThresholdRule implements DppValidationRule {
  readonly name = 'SubstanceOfConcernThresholdRule';

  validate(dpp: DppProductPassport): readonly ValidationFinding[] {
    return dpp.substancesOfConcern
      .flatMap((substance): ValidationFinding[] => {
        const concentrationPercent = substance.concentrationPercent;

        if (
          concentrationPercent === undefined
          || concentrationPercent <= MAX_SUBSTANCE_OF_CONCERN_PERCENTAGE
        ) {
          return [];
        }

        return [{
        severity: 'error',
        code: 'DPP_SUBSTANCE_OF_CONCERN_EXCEEDS_THRESHOLD',
        field: 'substancesOfConcern.concentrationPercent',
        message: `Substance "${substance.name}" exceeds the allowed threshold of ${MAX_SUBSTANCE_OF_CONCERN_PERCENTAGE}%. Current concentration is ${concentrationPercent.toFixed(2)}%.`,
        }];
      });
  }
}
