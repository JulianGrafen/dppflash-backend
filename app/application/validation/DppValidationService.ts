import { ZodError } from 'zod';
import type {
  DppValidationRule,
  DppWarningRule,
  GuardedDppPayload,
  ValidationMessage,
  ValidationReport,
  ValidationStatus,
} from '@/app/application/validation/DppValidationTypes';
import { dppPayloadSchema } from '@/app/application/validation/dppZodSchema';
import { CompletenessWarningRule } from '@/app/application/validation/rules/CompletenessWarningRule';
import { IdentifierFormatRule } from '@/app/application/validation/rules/IdentifierFormatRule';
import { MassBalanceRule } from '@/app/application/validation/rules/MassBalanceRule';
import { RangeCheckRule } from '@/app/application/validation/rules/RangeCheckRule';
import { SubstanceOfConcernThresholdRule } from '@/app/application/validation/rules/SubstanceOfConcernThresholdRule';

const SCHEMA_ERROR_SCORE_PENALTY = 20;
const RULE_ERROR_SCORE_PENALTY = 15;
const WARNING_SCORE_PENALTY = 5;

export interface DppValidationServiceOptions {
  readonly validationRules?: readonly DppValidationRule[];
  readonly warningRules?: readonly DppWarningRule[];
}

function toSchemaErrors(error: ZodError): readonly ValidationMessage[] {
  return error.issues.map((issue) => ({
    code: 'DPP_SCHEMA_VALIDATION_FAILED',
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

function calculateConfidenceScore(
  schemaErrorCount: number,
  ruleErrorCount: number,
  warningCount: number,
): number {
  const score = 100
    - schemaErrorCount * SCHEMA_ERROR_SCORE_PENALTY
    - ruleErrorCount * RULE_ERROR_SCORE_PENALTY
    - warningCount * WARNING_SCORE_PENALTY;

  return Math.max(0, Math.min(100, score));
}

function getStatus(errors: readonly ValidationMessage[], warnings: readonly ValidationMessage[]): ValidationStatus {
  if (errors.length > 0) {
    return 'FAILED';
  }

  if (warnings.length > 0) {
    return 'WARNING';
  }

  return 'PASSED';
}

export class DppValidationService {
  private readonly validationRules: readonly DppValidationRule[];

  private readonly warningRules: readonly DppWarningRule[];

  constructor(options: DppValidationServiceOptions = {}) {
    this.validationRules = options.validationRules ?? DppValidationService.createDefaultValidationRules();
    this.warningRules = options.warningRules ?? DppValidationService.createDefaultWarningRules();
  }

  validate(extractedJson: unknown): ValidationReport {
    const schemaResult = dppPayloadSchema.safeParse(extractedJson);

    if (!schemaResult.success) {
      const errors = toSchemaErrors(schemaResult.error);

      return {
        status: 'FAILED',
        errors,
        warnings: [],
        confidenceScore: calculateConfidenceScore(errors.length, 0, 0),
      };
    }

    const dpp = schemaResult.data as GuardedDppPayload;
    const errors = this.validationRules.flatMap((rule) => rule.validate(dpp));
    const warnings = this.warningRules.flatMap((rule) => rule.validate(dpp));

    return {
      status: getStatus(errors, warnings),
      errors,
      warnings,
      confidenceScore: calculateConfidenceScore(0, errors.length, warnings.length),
    };
  }

  static createDefaultValidationRules(): readonly DppValidationRule[] {
    return [
      new RangeCheckRule(),
      new IdentifierFormatRule(),
      new MassBalanceRule(),
      new SubstanceOfConcernThresholdRule(),
    ];
  }

  static createDefaultWarningRules(): readonly DppWarningRule[] {
    return [
      new CompletenessWarningRule(),
    ];
  }
}
