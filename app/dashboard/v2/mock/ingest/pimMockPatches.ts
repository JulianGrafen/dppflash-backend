import type { IngestPatchMap } from './types';

const PIM_DOC_ID = 'pim-webhook-demo';

export function buildPimMockPatches(tenantId: string): IngestPatchMap {
  return {
    'battery.passportIdentifier': {
      value: `PASS-${tenantId.replace(/^tenant_/, '').slice(0, 8).toUpperCase()}-001`,
      confidence: 0.92,
      provenance: 'ai',
      source: {
        kind: 'api',
        documentTitle: 'PIM Webhook — product.updated',
        documentId: PIM_DOC_ID,
        locationLabel: 'POST /api/v1/inbound/ingest/webhook (PIM_WEBHOOK)',
        contextSnippet: 'passportIdentifier assigned from PIM master record',
      },
    },
    'labelling.meaningOfLabels': {
      value: 'Separate collection — do not dispose with household waste.',
      confidence: 0.88,
      provenance: 'ai',
      source: {
        kind: 'api',
        documentTitle: 'PIM — labelling attributes',
        documentId: PIM_DOC_ID,
        locationLabel: 'attribute.labelling_meaning',
        contextSnippet: 'meaningOfLabels from PIM attribute set',
      },
    },
    'carbonFootprint.performanceClass': {
      value: 'B',
      confidence: 0.9,
      provenance: 'ai',
      source: {
        kind: 'api',
        documentTitle: 'PIM — sustainability attributes',
        documentId: PIM_DOC_ID,
        locationLabel: 'attribute.cf_performance_class',
        contextSnippet: 'Carbon footprint performance class: B',
      },
    },
  };
}
