import { z } from 'zod';

/**
 * Every extracted scalar / structured value must carry PDF provenance for ESPR audit.
 */
export function auditedField<S extends z.ZodTypeAny>(valueSchema: S) {
  return z.object({
    value: valueSchema,
    sourcePdf: z.string().min(1, 'sourcePdf is required.'),
    pageNumber: z.number().int().min(1, 'pageNumber must be >= 1.'),
    contextSnippet: z
      .string()
      .min(1, 'contextSnippet must cite verbatim evidence from the document.')
      .max(12_000),
  });
}

export const auditedStringSchema = auditedField(z.string());
export const auditedNumberSchema = auditedField(z.number().finite());
export const auditedBooleanSchema = auditedField(z.boolean());

export const compositionGraphNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  category: z.enum(['raw_material', 'processing', 'final_product']),
});

export const compositionGraphLinkSchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1),
  value: z.number().finite().nonnegative(),
});

export const compositionGraphSchema = z
  .object({
    nodes: z.array(compositionGraphNodeSchema).min(2, 'Sankey requires at least two nodes.'),
    links: z.array(compositionGraphLinkSchema).min(1, 'Sankey requires at least one link.'),
  })
  .superRefine((data, ctx) => {
    const ids = new Set(data.nodes.map((n) => n.id));
    data.links.forEach((link, i) => {
      if (!ids.has(link.source)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Link source "${link.source}" is not a node id.`,
          path: ['links', i, 'source'],
        });
      }
      if (!ids.has(link.target)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Link target "${link.target}" is not a node id.`,
          path: ['links', i, 'target'],
        });
      }
    });
  });

const auditedMaterialRowSchema = z.object({
  name: auditedStringSchema,
  sharePercent: auditedNumberSchema,
  recycledOrVirginNote: auditedStringSchema.optional(),
});

const auditedCertificateSchema = z.object({
  scheme: auditedStringSchema,
  certificateId: auditedStringSchema.optional(),
});

const auditedEnergySourceRowSchema = z.object({
  sourceLabel: auditedStringSchema,
  percent: auditedNumberSchema,
});

/**
 * Six ESPR-style regulatory pillars + mandatory material flow graph for Sankey UI.
 */
export const DppExtractionSchema = z.object({
  productIdentification: z.object({
    model: auditedStringSchema,
    sku: auditedStringSchema,
    batchId: auditedStringSchema,
    digitalLink: auditedStringSchema,
  }),
  economicOperator: z.object({
    manufacturer: auditedStringSchema,
    importer: auditedStringSchema,
    contactDetails: auditedStringSchema,
  }),
  materialCompositionAndSubstances: z.object({
    materials: z.array(auditedMaterialRowSchema).min(1, 'At least one material row is required.'),
    chemicalDeclarations: z.array(auditedStringSchema),
  }),
  environmentalFootprint: z.object({
    totalCo2eKg: auditedNumberSchema,
    energySourcesPercent: z
      .array(auditedEnergySourceRowSchema)
      .min(1, 'At least one energy source row is required (use 100% grid if only one source is stated).'),
  }),
  complianceAndCertifications: z.object({
    certificates: z.array(auditedCertificateSchema),
  }),
  circularityEndOfLife: z.object({
    repairLinks: auditedStringSchema,
    recyclabilityInstructions: auditedStringSchema,
    /** Entsorgung / Section 13 / AVV / Rückstände / packaging disposal — must cite verbatim source. */
    disposalInstructions: auditedStringSchema,
    lifecycleYears: auditedNumberSchema,
  }),
  compositionGraph: compositionGraphSchema,
});

export type DppExtractionPayload = z.infer<typeof DppExtractionSchema>;
export type AuditedString = z.infer<typeof auditedStringSchema>;
export type CompositionGraphPayload = z.infer<typeof compositionGraphSchema>;
export type CompositionGraphNodePayload = z.infer<typeof compositionGraphNodeSchema>;
export type CompositionGraphLinkPayload = z.infer<typeof compositionGraphLinkSchema>;

export function safeParseDppExtraction(input: unknown) {
  return DppExtractionSchema.safeParse(input);
}
