import type { DppProductPassport } from '@/app/domain/dpp/dppSchema';
import type {
  DppValidationRule,
  ValidationFinding,
} from '@/app/domain/dpp/validation/DppValidationTypes';

const MAX_TOTAL_PERCENTAGE = 100;

function sumPercentages(entries: readonly { readonly percentage: number }[]): number {
  return entries.reduce((total, entry) => total + entry.percentage, 0);
}

export class MaterialTotalPercentageRule implements DppValidationRule {
  readonly name = 'MaterialTotalPercentageRule';

  validate(dpp: DppProductPassport): readonly ValidationFinding[] {
    const totalMaterialPercentage = sumPercentages(dpp.materialComposition);
    const totalRecycledPercentage = sumPercentages(dpp.recycledContent);
    const totalPercentage = totalMaterialPercentage + totalRecycledPercentage;

    if (totalPercentage <= MAX_TOTAL_PERCENTAGE) {
      return [];
    }

    return [{
      severity: 'error',
      code: 'DPP_MATERIAL_TOTAL_EXCEEDS_100',
      field: 'materialComposition,recycledContent',
      message: `Total material share including recycled and virgin content must not exceed 100%. Current total is ${totalPercentage.toFixed(2)}%.`,
    }];
  }
}
