import type { DigitalProductPassport } from '@/app/domain/models/DppModel';

export type GuardedDppPayload = Omit<DigitalProductPassport, 'environmentalImpact'> & {
  readonly environmentalImpact: {
    readonly carbonFootprint?: number;
    readonly waterFootprint?: number;
  };
};

export type ValidationStatus = 'PASSED' | 'WARNING' | 'FAILED';

export interface ValidationMessage {
  readonly code: string;
  readonly message: string;
  readonly path?: string;
}

export interface ValidationReport {
  readonly status: ValidationStatus;
  readonly errors: readonly ValidationMessage[];
  readonly warnings: readonly ValidationMessage[];
  readonly confidenceScore: number;
}

export interface DppValidationRule {
  readonly name: string;
  validate(dpp: GuardedDppPayload): readonly ValidationMessage[];
}

export interface DppWarningRule {
  readonly name: string;
  validate(dpp: GuardedDppPayload): readonly ValidationMessage[];
}
