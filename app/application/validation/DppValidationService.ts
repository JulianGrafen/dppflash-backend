import { ZodError } from 'zod';
import { WasteCodeService } from '@/app/application/services/WasteCodeService';
import { checkComplianceGaps } from '@/app/domain/models/DppModel';
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractComplianceGapInput(payload: unknown): {
  readonly identification?: { readonly upi?: string; readonly gtin?: string };
  readonly composition?: readonly unknown[];
  readonly circularity?: { readonly disposalInstructions?: string };
} {
  if (!isRecord(payload)) {
    return {};
  }

  const identification = isRecord(payload.identification)
    ? {
        upi: typeof payload.identification.upi === 'string' ? payload.identification.upi : undefined,
        gtin: typeof payload.identification.gtin === 'string' ? payload.identification.gtin : undefined,
      }
    : undefined;

  const circularity = isRecord(payload.circularity)
    ? {
        disposalInstructions: typeof payload.circularity.disposalInstructions === 'string'
          ? payload.circularity.disposalInstructions
          : undefined,
      }
    : undefined;

  return {
    identification,
    composition: Array.isArray(payload.composition) ? payload.composition : undefined,
    circularity,
  };
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

function createGapMessages(dpp: {
  readonly identification?: { readonly upi?: string; readonly gtin?: string };
  readonly composition?: readonly unknown[];
  readonly circularity?: { readonly disposalInstructions?: string };
}): readonly ValidationMessage[] {
  const complianceGaps = checkComplianceGaps(dpp);

  return complianceGaps.map((gap) => ({
    code: 'DPP_COMPLIANCE_GAP',
    path: gap,
    message: `Mandatory ESPR field "${gap}" is missing and requires manual completion.`,
  }));
}

function splitGapMessages(
  gapMessages: readonly ValidationMessage[],
): { readonly errors: readonly ValidationMessage[]; readonly warnings: readonly ValidationMessage[] } {
  return {
    errors: gapMessages.filter((gap) => gap.path === 'identification.upi' || gap.path === 'composition'),
    warnings: gapMessages.filter((gap) => gap.path !== 'identification.upi' && gap.path !== 'composition'),
  };
}

function createRecyclingMessages(
  dpp: GuardedDppPayload,
): readonly ValidationMessage[] {
  const ewcCode = dpp.circularity.ewcCode;

  if (!ewcCode) {
    return [];
  }

  const resolution = WasteCodeService.resolve(ewcCode);
  const warnings: ValidationMessage[] = [];

  if (!resolution.found) {
    warnings.push({
      code: 'DPP_UNKNOWN_WASTE_CODE',
      path: 'circularity.ewcCode',
      message: `Waste code "${resolution.normalizedCode || ewcCode}" was not found in the configured mapping. Manual review by the specialist department is required.`,
    });
  }

  warnings.push({
    code: 'DPP_RECYCLING_GUIDANCE',
    path: 'circularity.ewcCode',
    message: resolution.instruction,
  });

  return warnings;
}

function toRequiredActions(messages: readonly ValidationMessage[]): readonly string[] {
  return [...new Set(messages.map((message) => message.message))];
}

function buildSchemaFailureReport(payload: unknown, errors: readonly ValidationMessage[]): ValidationReport {
  const gapInput = extractComplianceGapInput(payload);
  const complianceGaps = checkComplianceGaps(gapInput);
  const gapMessages = createGapMessages(gapInput);
  const splitGaps = splitGapMessages(gapMessages);
  const mergedErrors = [...errors, ...splitGaps.errors];
  const mergedWarnings = splitGaps.warnings;

  return {
    status: getStatus(mergedErrors, mergedWarnings),
    errors: mergedErrors,
    warnings: mergedWarnings,
    confidenceScore: calculateConfidenceScore(errors.length, splitGaps.errors.length, splitGaps.warnings.length),
    requiredActions: toRequiredActions([...mergedErrors, ...mergedWarnings]),
    complianceGaps,
  };
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
      return buildSchemaFailureReport(extractedJson, errors);
    }

    const dpp = schemaResult.data as GuardedDppPayload;
    const ruleErrors = this.validationRules.flatMap((rule) => rule.validate(dpp));
    const ruleWarnings = this.warningRules.flatMap((rule) => rule.validate(dpp));
    const gapMessages = createGapMessages(dpp);
    const splitGaps = splitGapMessages(gapMessages);
    const recyclingMessages = createRecyclingMessages(dpp);
    const errors = [...ruleErrors, ...splitGaps.errors];
    const warnings = [...ruleWarnings, ...splitGaps.warnings, ...recyclingMessages];
    const complianceGaps = checkComplianceGaps(dpp);
    const requiredActions = toRequiredActions([...errors, ...warnings]);

    return {
      status: getStatus(errors, warnings),
      errors,
      warnings,
      confidenceScore: calculateConfidenceScore(0, errors.length, warnings.length),
      requiredActions,
      complianceGaps,
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
