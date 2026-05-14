import { describe, expect, it } from 'vitest';
import { DppExtractionSchema, compositionGraphSchema } from '@/app/domain/dpp/dppExtractionZodSchema';

const audited = (value: unknown, snippet = 'evidence') => ({
  value,
  sourcePdf: 'spec.pdf',
  pageNumber: 1,
  contextSnippet: snippet,
});

describe('DppExtractionSchema', () => {
  it('accepts a minimal valid payload with composition graph', () => {
    const payload = {
      productIdentification: {
        model: audited('Jacket X'),
        sku: audited('SKU-1'),
        batchId: audited('B-2024'),
        digitalLink: audited('https://example.com/dpp'),
      },
      economicOperator: {
        manufacturer: audited('ACME GmbH'),
        importer: audited('NOT_STATED_IN_SOURCE'),
        contactDetails: audited('info@acme.example'),
      },
      materialCompositionAndSubstances: {
        materials: [
          {
            name: audited('Recycled PET'),
            sharePercent: audited(60),
          },
        ],
        chemicalDeclarations: [audited('PFAS not intentionally added')],
      },
      environmentalFootprint: {
        totalCo2eKg: audited(12.5),
        energySourcesPercent: [
          {
            sourceLabel: audited('Grid electricity'),
            percent: audited(100),
          },
        ],
      },
      complianceAndCertifications: {
        certificates: [{ scheme: audited('GRS'), certificateId: audited('GRS-123') }],
      },
      circularityEndOfLife: {
        repairLinks: audited('https://example.com/repair'),
        recyclabilityInstructions: audited('Separate by material stream.'),
        disposalInstructions: audited('Entsorgung über zugelassene Entsorgungsfachbetriebe.'),
        lifecycleYears: audited(5),
      },
      compositionGraph: {
        nodes: [
          { id: 'pet', label: 'Recycled PET', category: 'raw_material' as const },
          { id: 'spin', label: 'Yarn spinning', category: 'processing' as const },
          { id: 'shell', label: 'Jacket shell', category: 'final_product' as const },
        ],
        links: [
          { source: 'pet', target: 'spin', value: 60 },
          { source: 'spin', target: 'shell', value: 60 },
        ],
      },
    };

    const parsed = DppExtractionSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it('rejects links that reference unknown node ids', () => {
    const graph = {
      nodes: [
        { id: 'a', label: 'A', category: 'raw_material' },
        { id: 'b', label: 'B', category: 'final_product' },
      ],
      links: [{ source: 'a', target: 'missing', value: 10 }],
    };
    const r = compositionGraphSchema.safeParse(graph);
    expect(r.success).toBe(false);
  });
});
