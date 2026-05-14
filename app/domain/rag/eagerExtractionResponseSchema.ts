import { z } from 'zod';
import type { ExtractedAttributeRow } from '@/app/domain/rag/extractedAttributesJson';

/** Ein Feld aus der Eager-LLM-Antwort — nur `value` / `sourcePdf` / `contextSnippet` (keine weiteren Keys). */
const eagerExtractionFieldRowSchema = z
  .object({
    value: z.string().nullable(),
    sourcePdf: z.string(),
    contextSnippet: z.string(),
  })
  .strict();

/**
 * Striktes Eager-Schema: nur diese englischen/technischen Top-Level-Keys, keine weiteren.
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
    gtin: eagerExtractionFieldRowSchema.optional(),
  })
  .strict();

/** Alias gemäß Produkt-Spezifikation „eagerExtractionSchema“. */
export const eagerExtractionSchema = eagerExtractionResponseSchema;

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
  'gtin',
] as const satisfies readonly (keyof EagerExtractionResponse)[];

/** Default-Konfidenz für Eager-Zeilen, wenn das LLM keine Confidence liefert. */
const EAGER_DEFAULT_CONFIDENCE = 0.88;

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
    if (chunk.value === null || String(chunk.value).trim() === '') {
      continue;
    }
    const sourcePdf = chunk.sourcePdf.trim().length > 0 ? chunk.sourcePdf : defaultSourcePdf;
    out[k] = {
      value: chunk.value,
      sourcePdf,
      contextSnippet: chunk.contextSnippet,
      pageNumber: 1,
      confidence: EAGER_DEFAULT_CONFIDENCE,
    };
  }
  return out;
}
