import { describe, expect, it } from 'vitest';
import { mergeRagAuditIntoPassport } from '@/app/domain/rag/mergeRagAuditIntoPassport';
import { parseAuditTrail } from '@/app/domain/rag/auditTrailSchema';
import type { BatteryDPP, ChemicalDPP } from '@/app/types/dpp-types';

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

  it('mirrors legacy ewcCode audit into wasteCode when wasteCode is empty', () => {
    const passport = {
      id: 'p2',
      type: 'CHEMICAL',
      createdAt: new Date(),
      language: 'de',
      hersteller: 'X',
      modellname: 'Y',
    } as ChemicalDPP;

    const snippet = 'Abfallschluessel 08 04 09*';
    const trail = parseAuditTrail({
      ewcCode: {
        value: '08 04 09*',
        confidence: 1,
        source: { fileName: 'sdb.pdf', pageNumber: 2, contextSnippet: snippet },
        requiresManualReview: false,
      },
    });

    const { patch, appliedKeys } = mergeRagAuditIntoPassport(passport, trail, [
      'hersteller',
      'modellname',
      'ewcCode',
      'wasteCode',
    ]);

    expect(appliedKeys).toEqual(expect.arrayContaining(['ewcCode', 'wasteCode']));
    expect(patch.ewcCode).toBe('08 04 09*');
    expect(patch.wasteCode).toBe('08 04 09*');
  });
});
