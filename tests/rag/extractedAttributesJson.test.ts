import { describe, expect, it } from 'vitest';
import { extractedAttributesToAuditTrailFields } from '@/app/domain/rag/extractedAttributesJson';

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
