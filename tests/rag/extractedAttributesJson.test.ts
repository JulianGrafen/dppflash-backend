import { describe, expect, it } from 'vitest';
import {
  extractedAttributesToAuditTrailFields,
  mergeExtractedAttributesJsonForPersistence,
} from '@/app/domain/rag/extractedAttributesJson';

describe('mergeExtractedAttributesJsonForPersistence', () => {
  it('keeps existing top-level keys not present in incoming', () => {
    const existing = {
      gtin: { value: '123', sourcePdf: 'a.pdf', contextSnippet: 'x', confidence: 0.9 },
      hersteller: { value: 'OldCo', sourcePdf: 'a.pdf', contextSnippet: 'y', confidence: 0.8 },
    };
    const incoming = {
      modellname: {
        value: 'M1',
        sourcePdf: 'b.pdf',
        contextSnippet: 'z',
        confidence: 0.85,
      },
    };
    const merged = mergeExtractedAttributesJsonForPersistence(existing, incoming);
    expect(merged.gtin).toEqual(existing.gtin);
    expect(merged.hersteller).toEqual(existing.hersteller);
    expect(merged.modellname).toMatchObject(incoming.modellname);
  });

  it('keeps higher-confidence field when incoming is weaker', () => {
    const existing = {
      gtin: { value: '111', sourcePdf: 'a.pdf', contextSnippet: 'x', confidence: 0.95 },
    };
    const incoming = {
      gtin: { value: '999', sourcePdf: 'b.pdf', contextSnippet: 'y', confidence: 0.3 },
    };
    const merged = mergeExtractedAttributesJsonForPersistence(existing, incoming);
    expect(merged.gtin).toEqual(existing.gtin);
  });

  it('replaces when incoming confidence is equal or higher', () => {
    const existing = {
      gtin: { value: '111', sourcePdf: 'a.pdf', contextSnippet: 'x', confidence: 0.5 },
    };
    const incoming = {
      gtin: { value: '222', sourcePdf: 'b.pdf', contextSnippet: 'y', confidence: 0.5 },
    };
    const merged = mergeExtractedAttributesJsonForPersistence(existing, incoming);
    expect((merged.gtin as { value: string }).value).toBe('222');
  });
});

describe('extractedAttributesToAuditTrailFields', () => {
  it('matches manufacturer key when gap asks for hersteller', () => {
    const stored = {
      manufacturer: {
        value: 'ACME GmbH',
        sourcePdf: 'doc.pdf',
        contextSnippet: 'Hersteller ACME GmbH',
        confidence: 0.9,
      },
    };
    const { fields, keyResolution } = extractedAttributesToAuditTrailFields(stored, ['hersteller']);
    expect(fields.hersteller?.value).toBe('ACME GmbH');
    expect(fields.hersteller?.source.fileName).toBe('doc.pdf');
    expect(keyResolution).toEqual([{ missingField: 'hersteller', usedStoredKey: 'manufacturer' }]);
  });

  it('is case-insensitive on JSON keys', () => {
    const stored = {
      Hersteller: {
        value: 'X',
        sourcePdf: 'a.pdf',
        contextSnippet: 'ctx',
        confidence: 0.8,
      },
    };
    const { fields } = extractedAttributesToAuditTrailFields(stored, ['hersteller']);
    expect(fields.hersteller?.value).toBe('X');
  });

  it('maps ewcCode gap to wasteCode in JSON', () => {
    const stored = {
      wasteCode: {
        value: '17 02 03',
        sourcePdf: 'sds.pdf',
        contextSnippet: 'EWC 17 02 03',
        confidence: 0.7,
      },
    };
    const { fields, keyResolution } = extractedAttributesToAuditTrailFields(stored, ['ewcCode']);
    expect(fields.ewcCode?.value).toBe('17 02 03');
    expect(keyResolution[0]?.usedStoredKey).toBe('wasteCode');
  });
});
