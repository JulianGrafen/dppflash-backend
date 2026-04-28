import type { DppProductPassport } from '@/app/domain/dpp/dppSchema';
import type {
  DppValidationRule,
  ValidationFinding,
} from '@/app/domain/dpp/validation/DppValidationTypes';

const MAX_TOTAL_PERCENTAGE = 100;
const MASS_BALANCE_TOLERANCE = 0.1;

function sumPercentages(entries: readonly { readonly percentage: number }[]): number {
  return entries.reduce((total, entry) => total + entry.percentage, 0);
}

export class MaterialTotalPercentageRule implements DppValidationRule {
  readonly name = 'MaterialTotalPercentageRule';

  validate(dpp: DppProductPassport): readonly ValidationFinding[] {
    const totalMaterialPercentage = sumPercentages(dpp.materialComposition);
    const totalRecycledPercentage = sumPercentages(dpp.recycledContent);
    const findings: ValidationFinding[] = [];

    if (totalMaterialPercentage > MAX_TOTAL_PERCENTAGE + MASS_BALANCE_TOLERANCE) {
      findings.push({
        severity: 'error',
        code: 'DPP_MATERIAL_TOTAL_EXCEEDS_100',
        field: 'materialComposition',
        message: `Total material composition must not exceed 100% (+/- ${MASS_BALANCE_TOLERANCE} tolerance). Current total is ${totalMaterialPercentage.toFixed(2)}%.`,
      });
    }

    if (totalRecycledPercentage > totalMaterialPercentage + MASS_BALANCE_TOLERANCE) {
      findings.push({
        severity: 'error',
        code: 'DPP_RECYCLED_EXCEEDS_COMPOSITION',
        field: 'recycledContent',
        message: `Recycled content (${totalRecycledPercentage.toFixed(2)}%) cannot exceed total composition (${totalMaterialPercentage.toFixed(2)}%).`,
      });
    }

    return findings;
  }
}
