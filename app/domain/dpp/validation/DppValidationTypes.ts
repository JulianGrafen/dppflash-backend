import type { DppProductPassport } from '@/app/domain/dpp/dppSchema';

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationFinding {
  readonly severity: ValidationSeverity;
  readonly code: string;
  readonly message: string;
  readonly field?: string;
}

export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly score: number;
  readonly findings: readonly ValidationFinding[];
}

export interface ChemicalComponentKnowledgePort {
  getRequiredBaseComponents(productType: string): readonly string[];
}

export interface DppValidationContext {
  readonly chemicalKnowledge: ChemicalComponentKnowledgePort;
}

export interface DppValidationRule {
  readonly name: string;
  validate(dpp: DppProductPassport, context: DppValidationContext): readonly ValidationFinding[];
}
