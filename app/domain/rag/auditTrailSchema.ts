import { z } from 'zod';
import { sdsCompositionArraySchema } from '@/app/domain/rag/sdsCompositionSchema';
import { substanceConcernArraySchema } from '@/app/domain/rag/substanceConcernSchema';

/**
 * Single provenance bundle: every extracted value must cite exact source context.
 * (Data provenance / forensic audit trail.)
 */
export const SourceAttributionSchema = z.object({
  fileName: z.string().min(1, 'fileName is required.'),
  pageNumber: z.number().int().min(1, 'pageNumber must be >= 1.'),
  contextSnippet: z
    .string()
    .min(1, 'contextSnippet must contain the verbatim evidence span.'),
});

const auditedScalarValueSchema = z
  .union([z.null(), z.string(), z.number().finite()])
  .transform((v): string | null => {
    if (v === null) {
      return null;
    }
    if (typeof v === 'number') {
      return String(v);
    }
    const t = v.trim();
    return t.length === 0 ? null : t;
  })
  .pipe(z.union([z.string().min(1), z.null()]));

/** Skalar, SDS-Zusammensetzung oder besorgniserregende Stoffe (Eager/RAG). */
export const auditedPassportFieldValueSchema = z.union([
  substanceConcernArraySchema,
  sdsCompositionArraySchema,
  auditedScalarValueSchema,
]);

export const AuditedValueSchema = z.object({
  value: auditedPassportFieldValueSchema,
  confidence: z.coerce.number().min(0).max(1),
  source: SourceAttributionSchema,
  requiresManualReview: z.boolean(),
});

export type AuditedValue = z.infer<typeof AuditedValueSchema>;
export type SourceAttribution = z.infer<typeof SourceAttributionSchema>;

/**
 * MVP envelope for compliance extraction. Extend with additional keys as needed.
 */
const passportFieldsRecord = z.record(z.string().min(1).max(96), AuditedValueSchema);

export const AuditTrailSchema = z
  .object({
    /** Legacy single-field extractions (still supported for narrow queries). */
    gtin: AuditedValueSchema.optional(),
    ewcCode: AuditedValueSchema.optional(),
    /**
     * DPP/ESPR field keys → audited scalar (string form; numbers normalized at merge time),
     * strukturierte SDS-Zusammensetzung oder besorgniserregende Stoffe (Arrays).
     */
    fields: passportFieldsRecord.optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    const n = val.fields ? Object.keys(val.fields).length : 0;
    if (n > 48) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'fields must contain at most 48 keys.',
      });
    }
  });

export type AuditTrail = z.infer<typeof AuditTrailSchema>;

export function parseAuditTrail(input: unknown): AuditTrail {
  return AuditTrailSchema.parse(input);
}

export function safeParseAuditTrail(input: unknown) {
  return AuditTrailSchema.safeParse(input);
}
