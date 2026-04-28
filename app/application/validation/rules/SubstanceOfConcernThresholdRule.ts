import type {
  DppValidationRule,
  GuardedDppPayload,
  ValidationMessage,
} from '@/app/application/validation/DppValidationTypes';

const ESPR_SUBSTANCE_OF_CONCERN_THRESHOLD_PERCENT = 0.1;

export class SubstanceOfConcernThresholdRule implements DppValidationRule {
  readonly name = 'SubstanceOfConcernThresholdRule';

  validate(dpp: GuardedDppPayload): readonly ValidationMessage[] {
    return dpp.substancesOfConcern
      .filter((substance) => substance.concentration <= ESPR_SUBSTANCE_OF_CONCERN_THRESHOLD_PERCENT)
      .map((substance): ValidationMessage => ({
        code: 'DPP_SOC_BELOW_ESPR_THRESHOLD',
        path: 'substancesOfConcern.concentration',
        message: `Substance "${substance.name}" is marked as Substance of Concern but concentration is not > ${ESPR_SUBSTANCE_OF_CONCERN_THRESHOLD_PERCENT}%.`,
      }));
  }
}
