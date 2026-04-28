import type { DppProductPassport } from '@/app/domain/dpp/dppSchema';
import type {
  DppValidationRule,
  ValidationFinding,
} from '@/app/domain/dpp/validation/DppValidationTypes';

function hasValue(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export class MandatoryIdentifiersRule implements DppValidationRule {
  readonly name = 'MandatoryIdentifiersRule';

  validate(dpp: DppProductPassport): readonly ValidationFinding[] {
    const findings: ValidationFinding[] = [];

    if (!hasValue(dpp.upi)) {
      findings.push({
        severity: 'error',
        code: 'DPP_MISSING_UPI',
        field: 'upi',
        message: 'UPI is mandatory for ESPR Digital Product Passport identification.',
      });
    }

    if (!hasValue(dpp.gtin)) {
      findings.push({
        severity: 'error',
        code: 'DPP_MISSING_GTIN',
        field: 'gtin',
        message: 'GTIN is mandatory for product identification and traceability.',
      });
    }

    return findings;
  }
}
