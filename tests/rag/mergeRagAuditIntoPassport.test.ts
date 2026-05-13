import { describe, expect, it } from 'vitest';
import { mergeRagAuditIntoPassport } from '@/app/domain/rag/mergeRagAuditIntoPassport';
import { parseAuditTrail } from '@/app/domain/rag/auditTrailSchema';
import type { BatteryDPP } from '@/app/types/dpp-types';

describe('mergeRagAuditIntoPassport', () => {
  it('fills only empty keys from audited fields', () => {
    const passport = {
      id: 'p1',
      type: 'BATTERY',
      createdAt: new Date(),
      language: 'de',
      hersteller: '',
      modellname: '',
    } as BatteryDPP;

    const trail = parseAuditTrail({
      fields: {
        hersteller: {
          value: 'ACME',
          confidence: 1,
          source: { fileName: 'x.pdf', pageNumber: 1, contextSnippet: 'ACME' },
          requiresManualReview: false,
        },
        modellname: {
          value: 'Skip',
          confidence: 1,
          source: { fileName: 'x.pdf', pageNumber: 1, contextSnippet: 'Skip' },
          requiresManualReview: true,
        },
      },
    });

    const { patch, appliedKeys } = mergeRagAuditIntoPassport(passport, trail, [
      'hersteller',
      'modellname',
    ]);

    expect(appliedKeys).toEqual(['hersteller']);
    expect(patch).toEqual({ hersteller: 'ACME' });
  });
});
