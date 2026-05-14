import { describe, expect, it } from 'vitest';
import {
  buildGapTargetedSearchQuery,
  detectRagFillableGaps,
  mapGapFieldKeyToGermanSearchPhrase,
  resolvePrimaryProductNameAnchor,
} from '@/app/domain/rag/dppRagGapAnalysis';

describe('dppRagGapAnalysis', () => {
  it('mapGapFieldKeyToGermanSearchPhrase maps known keys', () => {
    expect(mapGapFieldKeyToGermanSearchPhrase('gtin')).toContain('GTIN');
    expect(mapGapFieldKeyToGermanSearchPhrase('unknownKey')).toBe('unknownKey');
  });

  it('buildGapTargetedSearchQuery uses German semantic terms, not raw JSON keys', () => {
    const q = buildGapTargetedSearchQuery(['materialComposition', 'manufacturer'], 'Cimsec S1');
    expect(q.startsWith('Suche nach:')).toBe(true);
    expect(q).toContain('Zusammensetzung');
    expect(q).toContain('Inverkehrbringer');
    expect(q).toContain('Cimsec S1');
    expect(q).toContain('für das Produkt:');
    expect(q).not.toContain('materialComposition');
    expect(q).not.toContain('manufacturer');
  });

  it('resolvePrimaryProductNameAnchor prefers productName, else modellname', () => {
    expect(resolvePrimaryProductNameAnchor({ productName: '  Cimsec S1  ' })).toBe('Cimsec S1');
    expect(resolvePrimaryProductNameAnchor({ productName: '', modellname: 'S1' })).toBe('S1');
    expect(resolvePrimaryProductNameAnchor({ modellname: '  S1  ' })).toBe('S1');
    expect(resolvePrimaryProductNameAnchor({ productName: '', modellname: '' })).toBeNull();
    expect(resolvePrimaryProductNameAnchor({})).toBeNull();
  });

  it('detectRagFillableGaps flags empty materialComposition', () => {
    const gaps = detectRagFillableGaps(
      {
        productName: 'X',
        materialComposition: [],
        gtin: '12345670',
      },
      'OTHER',
    );
    expect(gaps).toContain('materialComposition');
  });
});
