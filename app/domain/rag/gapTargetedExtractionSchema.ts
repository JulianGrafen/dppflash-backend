import { z } from 'zod';
import { resolveEagerRowConfidence } from '@/app/domain/rag/eagerExtractionResponseSchema';

/** Muss im User-Prompt vorkommen, damit Offline-Mocks den Kontext parsen können. */
export const GAP_TARGETED_CONTEXT_MARKER = '\n\n### KONTEXT_AUS_DATENBANK\n\n';

/**
 * Stufe-4-LLM: ein Eintrag pro gesuchtem Pass-Feld (vor Mapping auf {@link AuditedValue}).
 */
export const gapLlmFieldSchema = z.object({
  value: z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((v) => {
      if (v === null || v === undefined) {
        return null;
      }
      const s = String(v).trim();
      if (s.length === 0 || s.toLowerCase() === 'null') {
        return null;
      }
      return s;
    }),
  sourcePdf: z.coerce.string(),
  contextSnippet: z.coerce.string(),
  confidence: z.coerce.number().min(0).max(1).optional(),
});

export type GapLlmFieldRow = z.infer<typeof gapLlmFieldSchema>;

export function buildGapLlmResponseSchema(missingFieldKeys: readonly string[]) {
  const shape = Object.fromEntries(missingFieldKeys.map((k) => [k, gapLlmFieldSchema])) as Record<
    string,
    typeof gapLlmFieldSchema
  >;
  return z.object(shape);
}
