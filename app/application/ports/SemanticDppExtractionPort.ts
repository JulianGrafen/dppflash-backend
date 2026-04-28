import type { DppProductPassport } from '@/app/domain/dpp/dppSchema';

export interface SemanticDppExtractionInput {
  readonly pdf: Buffer;
  readonly fileName: string;
  readonly productTypeHint?: string;
}

export interface SemanticDppExtractionResult {
  readonly dpp: DppProductPassport;
  readonly confidence: number;
  readonly warnings: readonly string[];
  readonly pageCount: number;
}

export interface SemanticDppExtractionPort {
  extract(input: SemanticDppExtractionInput): Promise<SemanticDppExtractionResult>;
}
