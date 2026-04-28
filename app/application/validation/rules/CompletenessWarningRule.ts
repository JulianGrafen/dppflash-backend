import type {
  DppWarningRule,
  GuardedDppPayload,
  ValidationMessage,
} from '@/app/application/validation/DppValidationTypes';

export class CompletenessWarningRule implements DppWarningRule {
  readonly name = 'CompletenessWarningRule';

  validate(dpp: GuardedDppPayload): readonly ValidationMessage[] {
    const warnings: ValidationMessage[] = [];

    if (dpp.environmentalImpact.carbonFootprint === undefined) {
      warnings.push({
        code: 'DPP_MISSING_CARBON_FOOTPRINT',
        path: 'environmentalImpact.carbonFootprint',
        message: 'Carbon footprint is missing; manual ESPR review is recommended.',
      });
    }

    if (!dpp.identification.gtin) {
      warnings.push({
        code: 'DPP_MISSING_GTIN',
        path: 'identification.gtin',
        message: 'GTIN is missing; verify whether this product category legally requires one.',
      });
    }

    if (dpp.substancesOfConcern.length === 0) {
      warnings.push({
        code: 'DPP_NO_SUBSTANCES_DECLARED',
        path: 'substancesOfConcern',
        message: 'No Substances of Concern were declared; confirm that this is intentional.',
      });
    }

    return warnings;
  }
}
