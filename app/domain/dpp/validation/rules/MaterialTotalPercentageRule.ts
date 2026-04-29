import type { DppProductPassport } from '@/app/domain/dpp/dppSchema';
import type {
  DppValidationRule,
  ValidationFinding,
} from '@/app/domain/dpp/validation/DppValidationTypes';

const REQUIRED_TOTAL_PERCENTAGE = 100;
const MASS_BALANCE_TOLERANCE = 0.01;

function sumPercentages(entries: readonly { readonly percentage: number }[]): number {
  return entries.reduce((total, entry) => total + entry.percentage, 0);
}

export class MaterialTotalPercentageRule implements DppValidationRule {
  readonly name = 'MaterialTotalPercentageRule';

  validate(dpp: DppProductPassport): readonly ValidationFinding[] {
    const totalMaterialPercentage = sumPercentages(dpp.materialComposition);
    const totalRecycledPercentage = sumPercentages(dpp.recycledContent);
    const findings: ValidationFinding[] = [];

    if (Math.abs(totalMaterialPercentage - REQUIRED_TOTAL_PERCENTAGE) > MASS_BALANCE_TOLERANCE) {
      findings.push({
        severity: 'error',
        code: 'DPP_MATERIAL_TOTAL_NOT_100',
        field: 'materialComposition',
        message: `Total material composition must equal exactly ${REQUIRED_TOTAL_PERCENTAGE}% (+/- ${MASS_BALANCE_TOLERANCE} tolerance). Current total is ${totalMaterialPercentage.toFixed(2)}%.`,
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
