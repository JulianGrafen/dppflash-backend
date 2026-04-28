import type {
  DppValidationRule,
  GuardedDppPayload,
  ValidationMessage,
} from '@/app/application/validation/DppValidationTypes';

const MAX_COMPOSITION_PERCENTAGE_WITH_TOLERANCE = 100.1;

export class MassBalanceRule implements DppValidationRule {
  readonly name = 'MassBalanceRule';

  validate(dpp: GuardedDppPayload): readonly ValidationMessage[] {
    const totalPercentage = dpp.composition.reduce(
      (sum, material) => sum + material.percentage,
      0,
    );

    if (totalPercentage <= MAX_COMPOSITION_PERCENTAGE_WITH_TOLERANCE) {
      return [];
    }

    return [{
      code: 'DPP_MASS_BALANCE_EXCEEDED',
      path: 'composition',
      message: `Material composition totals ${totalPercentage.toFixed(2)}%, exceeding the allowed 100% mass balance tolerance.`,
    }];
  }
}
