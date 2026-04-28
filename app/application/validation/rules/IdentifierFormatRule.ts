import type {
  DppValidationRule,
  GuardedDppPayload,
  ValidationMessage,
} from '@/app/application/validation/DppValidationTypes';

const UPI_PATTERN = /^[A-Z0-9][A-Z0-9._:-]{5,63}$/i;
const GTIN_PATTERN = /^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/;

export class IdentifierFormatRule implements DppValidationRule {
  readonly name = 'IdentifierFormatRule';

  validate(dpp: GuardedDppPayload): readonly ValidationMessage[] {
    const findings: ValidationMessage[] = [];

    if (!UPI_PATTERN.test(dpp.identification.upi)) {
      findings.push({
        code: 'DPP_INVALID_UPI_FORMAT',
        path: 'identification.upi',
        message: 'UPI must be 6-64 characters and contain only letters, digits, dots, underscores, colons or hyphens.',
      });
    }

    if (dpp.identification.gtin && !GTIN_PATTERN.test(dpp.identification.gtin)) {
      findings.push({
        code: 'DPP_INVALID_GTIN_FORMAT',
        path: 'identification.gtin',
        message: 'GTIN must be 8, 12, 13 or 14 digits.',
      });
    }

    return findings;
  }
}
