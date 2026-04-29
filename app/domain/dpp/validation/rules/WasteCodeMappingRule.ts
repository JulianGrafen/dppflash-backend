import { WasteCodeService } from '@/app/application/services/WasteCodeService';
import type { DppProductPassport } from '@/app/domain/dpp/dppSchema';
import type {
  DppValidationRule,
  ValidationFinding,
} from '@/app/domain/dpp/validation/DppValidationTypes';

export class WasteCodeMappingRule implements DppValidationRule {
  readonly name = 'WasteCodeMappingRule';

  validate(dpp: DppProductPassport): readonly ValidationFinding[] {
    if (!dpp.wasteCode) {
      return [];
    }

    const resolution = WasteCodeService.resolve(dpp.wasteCode);

    if (resolution.found) {
      return [];
    }

    return [{
      severity: 'warning',
      code: 'DPP_UNKNOWN_WASTE_CODE',
      field: 'wasteCode',
      message: `Waste code "${resolution.normalizedCode || dpp.wasteCode}" was not found in the configured mapping. Manual review by the specialist department is required.`,
    }];
  }
}
