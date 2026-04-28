import type { DppProductPassport } from '@/app/domain/dpp/dppSchema';
import { DefaultChemicalComponentKnowledge } from '@/app/domain/dpp/validation/DefaultChemicalComponentKnowledge';
import type {
  ChemicalComponentKnowledgePort,
  DppValidationContext,
  DppValidationRule,
  ValidationFinding,
  ValidationResult,
} from '@/app/domain/dpp/validation/DppValidationTypes';
import { AdhesiveChemicalComponentsRule } from '@/app/domain/dpp/validation/rules/AdhesiveChemicalComponentsRule';
import { CarbonFootprintRule } from '@/app/domain/dpp/validation/rules/CarbonFootprintRule';
import { MandatoryIdentifiersRule } from '@/app/domain/dpp/validation/rules/MandatoryIdentifiersRule';
import { MaterialTotalPercentageRule } from '@/app/domain/dpp/validation/rules/MaterialTotalPercentageRule';
import { PercentageRangeRule } from '@/app/domain/dpp/validation/rules/PercentageRangeRule';
import { SubstanceOfConcernThresholdRule } from '@/app/domain/dpp/validation/rules/SubstanceOfConcernThresholdRule';

const ERROR_SCORE_PENALTY = 25;
const WARNING_SCORE_PENALTY = 10;

interface DppValidationServiceOptions {
  readonly rules?: readonly DppValidationRule[];
  readonly chemicalKnowledge?: ChemicalComponentKnowledgePort;
}

function toMessages(findings: readonly ValidationFinding[], severity: 'error' | 'warning'): readonly string[] {
  return findings
    .filter((finding) => finding.severity === severity)
    .map((finding) => `${finding.code}: ${finding.message}`);
}

function calculateScore(findings: readonly ValidationFinding[]): number {
  const score = findings.reduce((currentScore, finding) => {
    const penalty = finding.severity === 'error' ? ERROR_SCORE_PENALTY : WARNING_SCORE_PENALTY;
    return currentScore - penalty;
  }, 100);

  return Math.max(0, Math.min(100, score));
}

export class DppValidationService {
  private readonly rules: readonly DppValidationRule[];

  private readonly context: DppValidationContext;

  constructor(options: DppValidationServiceOptions = {}) {
    this.rules = options.rules ?? DppValidationService.createDefaultRules();
    this.context = {
      chemicalKnowledge: options.chemicalKnowledge ?? new DefaultChemicalComponentKnowledge(),
    };
  }

  validate(dpp: DppProductPassport): ValidationResult {
    const findings = this.rules.flatMap((rule) => rule.validate(dpp, this.context));
    const errors = toMessages(findings, 'error');
    const warnings = toMessages(findings, 'warning');

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score: calculateScore(findings),
      findings,
    };
  }

  static createDefaultRules(): readonly DppValidationRule[] {
    return [
      new MandatoryIdentifiersRule(),
      new PercentageRangeRule(),
      new MaterialTotalPercentageRule(),
      new CarbonFootprintRule(),
      new AdhesiveChemicalComponentsRule(),
      new SubstanceOfConcernThresholdRule(),
    ];
  }
}
