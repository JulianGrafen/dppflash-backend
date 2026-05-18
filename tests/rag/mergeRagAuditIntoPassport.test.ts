import { describe, expect, it } from 'vitest';
import {
  flattenProvenancePatchForPersistence,
  mergeRagAuditIntoPassport,
} from '@/app/domain/rag/mergeRagAuditIntoPassport';
import { parseAuditTrail } from '@/app/domain/rag/auditTrailSchema';
import type { BatteryDPP, ChemicalDPP, GenericDPP } from '@/app/types/dpp-types';

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

  it('treats PENDING_EXTERNAL_MATCH as empty so RAG can fill gtin', () => {
    const passport = {
      id: 'p3',
      type: 'BATTERY',
      createdAt: new Date(),
      language: 'de',
      hersteller: 'X',
      modellname: 'Y',
      gtin: 'PENDING_EXTERNAL_MATCH',
    } as BatteryDPP;

    const trail = parseAuditTrail({
      gtin: {
        value: '5901234123457',
        confidence: 0.9,
        source: { fileName: 'x.pdf', pageNumber: 1, contextSnippet: '5901234123457' },
        requiresManualReview: false,
      },
    });

    const { patch, appliedKeys } = mergeRagAuditIntoPassport(passport, trail, [
      'hersteller',
      'modellname',
      'gtin',
    ]);

    expect(appliedKeys).toContain('gtin');
    expect(patch.gtin).toBe('5901234123457');
  });

  it('maps fields.ean audited value onto passport gtin when gtin is empty', () => {
    const passport = {
      id: 'p4',
      type: 'BATTERY',
      createdAt: new Date(),
      language: 'de',
      hersteller: 'X',
      modellname: 'Y',
      gtin: '',
    } as BatteryDPP;

    const trail = parseAuditTrail({
      fields: {
        ean: {
          value: '5901234123457',
          confidence: 1,
          source: { fileName: 'x.pdf', pageNumber: 1, contextSnippet: '5901234123457' },
          requiresManualReview: false,
        },
      },
    });

    const { patch, appliedKeys } = mergeRagAuditIntoPassport(passport, trail, ['gtin']);

    expect(appliedKeys).toContain('gtin');
    expect(patch.gtin).toBe('5901234123457');
  });

  it('treats empty materialComposition array as empty so audited scalar can apply', () => {
    const passport = {
      id: 'p5',
      type: 'OTHER',
      createdAt: new Date(),
      language: 'de',
      materialComposition: [],
    } as GenericDPP;

    const trail = parseAuditTrail({
      fields: {
        materialComposition: {
          value: 'Stahl 60 %, Kunststoff 40 %',
          confidence: 0.95,
          source: { fileName: 'x.pdf', pageNumber: 1, contextSnippet: 'Stahl 60' },
          requiresManualReview: false,
        },
      },
    });

    const { patch, appliedKeys } = mergeRagAuditIntoPassport(passport, trail, [
      'materialComposition',
    ]);

    expect(appliedKeys).toContain('materialComposition');
    expect(patch.materialComposition).toBe('Stahl 60 %, Kunststoff 40 %');
  });

  it('writes provenance-shaped patches when fieldShape is provenance', () => {
    const passport = {
      id: 'p6',
      type: 'CHEMICAL',
      createdAt: new Date(),
      language: 'de',
      hersteller: '',
      modellname: 'Y',
    } as ChemicalDPP;

    const trail = parseAuditTrail({
      fields: {
        hersteller: {
          value: 'Henkel',
          confidence: 0.95,
          source: { fileName: 'sdb.pdf', pageNumber: 1, contextSnippet: 'Firma Henkel' },
          requiresManualReview: false,
        },
      },
    });

    const { patch, appliedKeys } = mergeRagAuditIntoPassport(passport, trail, ['hersteller'], {
      fieldShape: 'provenance',
    });

    expect(appliedKeys).toContain('hersteller');
    expect(patch.hersteller).toEqual({
      value: 'Henkel',
      contextSnippet: 'Firma Henkel',
      sourcePdf: 'sdb.pdf',
      pageNumber: 1,
      confidence: 0.95,
    });
  });

  it('flattenProvenancePatchForPersistence unwraps provenance envelopes for DB/API', () => {
    const flat = flattenProvenancePatchForPersistence({
      hersteller: {
        value: 'ACME',
        contextSnippet: 'ctx',
        sourcePdf: 'a.pdf',
        pageNumber: 2,
      },
      gtin: '123',
    });
    expect(flat.hersteller).toBe('ACME');
    expect(flat.gtin).toBe('123');
  });

  it('treats placeholder null string hersteller as empty so RAG can fill', () => {
    const passport = {
      id: 'p7',
      type: 'CHEMICAL',
      createdAt: new Date(),
      language: 'de',
      hersteller: 'null',
      modellname: 'Y',
    } as ChemicalDPP;

    const trail = parseAuditTrail({
      fields: {
        hersteller: {
          value: 'Real GmbH',
          confidence: 1,
          source: { fileName: 'x.pdf', pageNumber: 1, contextSnippet: 'Real GmbH' },
          requiresManualReview: false,
        },
      },
    });

    const { patch, appliedKeys } = mergeRagAuditIntoPassport(passport, trail, ['hersteller']);
    expect(appliedKeys).toContain('hersteller');
    expect(patch.hersteller).toBe('Real GmbH');
  });
});
