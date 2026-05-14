import { describe, expect, it } from 'vitest';
import {
  buildProductIdentityQueryPrefix,
  buildProductMatchTerms,
  computeRetrievalMatchConfidence,
} from '@/app/domain/rag/productBrainMatch';

describe('productBrainMatch', () => {
  it('buildProductMatchTerms collects passport identity tokens', () => {
    const terms = buildProductMatchTerms(
      {
        productName: 'Cimsec Fliesen Kleber S1 Flex Schnell',
        hersteller: 'Cimsec',
        modellname: 'S1',
      },
      'Cimsec S1',
    );
    expect(terms).toContain('cimsec');
    expect(terms).toContain('fliesen');
    expect(terms).toContain('flex');
    expect(terms).toContain('schnell');
  });

  it('adds normalized GTIN digits so a second PDF mentioning the barcode can rank', () => {
    const terms = buildProductMatchTerms({ gtin: '590 1234 1234 57', productName: 'Kleber' }, 'X');
    expect(terms).toContain('5901234123457');
  });

  it('includes gtin in identity query prefix', () => {
    const prefix = buildProductIdentityQueryPrefix({ gtin: '5901234123457', productName: 'Y' }, 'X');
    expect(prefix).toContain('5901234123457');
  });

  it('computeRetrievalMatchConfidence rises with term coverage and same-file hint', () => {
    const low = computeRetrievalMatchConfidence(
      [{ text: 'generic', fileName: 'a.pdf', score: 0.2 }],
      ['cimsec', 'flex'],
    );
    const high = computeRetrievalMatchConfidence(
      [{ text: 'Cimsec Kleber Flex', fileName: 'merkblatt.pdf', score: 0.2 }],
      ['cimsec', 'flex'],
    );
    const withFile = computeRetrievalMatchConfidence(
      [{ text: 'Cimsec Kleber Flex', fileName: 'merkblatt.pdf', score: 0.2 }],
      ['cimsec', 'flex'],
      'merkblatt.pdf',
    );
    expect(high).toBeGreaterThan(low);
    expect(withFile).toBeGreaterThanOrEqual(high);
  });
});
