import { z } from 'zod';
import type { ExtractedAttributeRow } from '@/app/domain/rag/extractedAttributesJson';

/**
 * Ein Feld aus der Eager-LLM-Antwort (nur diese Keys erlaubt; Top-Level strikt).
 * `pageNumber` / `confidence` optional, damit bestehende Prompt-Hinweise nicht brechen.
 */
const eagerExtractionFieldRowSchema = z.object({
  value: z.string().nullable(),
  sourcePdf: z.string(),
  contextSnippet: z.string(),
  pageNumber: z.number().int().min(1).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

/**
 * Striktes Schema für die Eager-Extraktion: **keine** weiteren Top-Level-Keys.
 * (Orchestrator / Passport erwarten u.a. `chemicalComposition`, `endOfLifeInstructions`, `modellname`.)
 */
export const eagerExtractionResponseSchema = z
  .object({
    hersteller: eagerExtractionFieldRowSchema.optional(),
    modellname: eagerExtractionFieldRowSchema.optional(),
    ewcCode: eagerExtractionFieldRowSchema.optional(),
    wasteCode: eagerExtractionFieldRowSchema.optional(),
    countryOfOrigin: eagerExtractionFieldRowSchema.optional(),
    countryOfManufacturing: eagerExtractionFieldRowSchema.optional(),
    endOfLifeInstructions: eagerExtractionFieldRowSchema.optional(),
    chemicalComposition: eagerExtractionFieldRowSchema.optional(),
  })
  .strict();

export type EagerExtractionResponse = z.infer<typeof eagerExtractionResponseSchema>;

const EAGER_ROW_KEYS = [
  'hersteller',
  'modellname',
  'ewcCode',
  'wasteCode',
  'countryOfOrigin',
  'countryOfManufacturing',
  'endOfLifeInstructions',
  'chemicalComposition',
] as const satisfies readonly (keyof EagerExtractionResponse)[];

export function eagerExtractionResponseToRows(
  data: EagerExtractionResponse,
  defaultSourcePdf: string,
): Record<string, ExtractedAttributeRow> {
  const out: Record<string, ExtractedAttributeRow> = {};
  for (const k of EAGER_ROW_KEYS) {
    const chunk = data[k];
    if (!chunk) {
      continue;
    }
    const sourcePdf = chunk.sourcePdf.trim().length > 0 ? chunk.sourcePdf : defaultSourcePdf;
    out[k] = {
      value: chunk.value,
      sourcePdf,
      contextSnippet: chunk.contextSnippet,
      pageNumber: chunk.pageNumber ?? 1,
      confidence:
        typeof chunk.confidence === 'number' && Number.isFinite(chunk.confidence)
          ? Math.min(1, Math.max(0, chunk.confidence))
          : 0,
    };
  }
  return out;
}
