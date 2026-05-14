import { describe, expect, it } from 'vitest';
import { parseAuditTrail } from '@/app/domain/rag/auditTrailSchema';
import { isValidGtinDigits } from '@/app/domain/rag/gtinProof';
import {
  stripCryptoInvalidAuditedValues,
  validateAuditTrailCryptographically,
} from '@/app/domain/rag/auditTrailValidation';

describe('auditTrailSchema', () => {
  it('parses fields map with audited entries', () => {
    const trail = parseAuditTrail({
      fields: {
        hersteller: {
          value: 'ACME GmbH',
          confidence: 0.88,
          source: {
            fileName: 'sds.pdf',
            pageNumber: 1,
            contextSnippet: 'Hersteller: ACME GmbH',
          },
          requiresManualReview: false,
        },
      },
    });

    expect(trail.fields?.hersteller?.value).toBe('ACME GmbH');
  });

  it('parses a minimal audited GTIN envelope', () => {
    const trail = parseAuditTrail({
      gtin: {
        value: '5901234123457',
        confidence: 0.9,
        source: {
          fileName: 'sds.pdf',
          pageNumber: 3,
          contextSnippet: 'GTIN / EAN: 5901234123457',
        },
        requiresManualReview: false,
      },
    });

    expect(trail.gtin?.value).toBe('5901234123457');
  });
});

describe('gtinProof', () => {
  it('accepts a valid GTIN-13 checksum', () => {
    expect(isValidGtinDigits('5901234123457')).toBe(true);
  });

  it('rejects invalid checksum', () => {
    expect(isValidGtinDigits('4005800012340')).toBe(false);
  });
});

describe('auditTrailValidation', () => {
  it('flags invalid GTIN after schema pass', () => {
    const trail = parseAuditTrail({
      gtin: {
        value: '123',
        confidence: 1,
        source: {
          fileName: 'x.pdf',
          pageNumber: 1,
          contextSnippet: '123',
        },
        requiresManualReview: false,
      },
    });

    const result = validateAuditTrailCryptographically(trail);
    expect(result.ok).toBe(false);
  });

  it('stripCryptoInvalidAuditedValues keeps valid fields when GTIN is invalid', () => {
    const trail = parseAuditTrail({
      fields: {
        gtin: {
          value: '123',
          confidence: 1,
          source: { fileName: 'x.pdf', pageNumber: 1, contextSnippet: '123' },
          requiresManualReview: false,
        },
        hersteller: {
          value: 'ACME',
          confidence: 0.9,
          source: { fileName: 'x.pdf', pageNumber: 1, contextSnippet: 'ACME GmbH' },
          requiresManualReview: false,
        },
      },
    });

    expect(validateAuditTrailCryptographically(trail).ok).toBe(false);
    const stripped = stripCryptoInvalidAuditedValues(trail);
    expect(stripped.fields?.hersteller?.value).toBe('ACME');
    expect(stripped.fields?.gtin).toBeUndefined();
    expect(validateAuditTrailCryptographically(stripped).ok).toBe(true);
  });
});
