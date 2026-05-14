import type { DppExtractionPayload } from '@/app/domain/dpp/dppExtractionZodSchema';

export interface RegulatoryStructuredDppExtractionInput {
  readonly pdf: Buffer;
  /** Display name of the PDF (stored as `sourcePdf` on audited fields). */
  readonly sourcePdf: string;
}

export interface RegulatoryStructuredDppExtractionPort {
  extract(input: RegulatoryStructuredDppExtractionInput): Promise<DppExtractionPayload>;
}
