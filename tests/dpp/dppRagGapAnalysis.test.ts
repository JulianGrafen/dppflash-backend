import { describe, expect, it } from 'vitest';
import {
  buildGapTargetedSearchQuery,
  detectRagFillableGaps,
  resolvePrimaryProductNameAnchor,
} from '@/app/domain/rag/dppRagGapAnalysis';

describe('dppRagGapAnalysis', () => {
  it('resolvePrimaryProductNameAnchor requires non-empty productName', () => {
    expect(resolvePrimaryProductNameAnchor({ productName: '  Cimsec S1  ' })).toBe('Cimsec S1');
    expect(resolvePrimaryProductNameAnchor({ productName: '' })).toBeNull();
    expect(resolvePrimaryProductNameAnchor({ modellname: 'S1' })).toBeNull();
  });

  it('buildGapTargetedSearchQuery joins missing fields and anchor', () => {
    const q = buildGapTargetedSearchQuery(['materialComposition', 'manufacturer'], 'Cimsec S1');
    expect(q).toContain('materialComposition');
    expect(q).toContain('manufacturer');
    expect(q).toContain('Cimsec S1');
    expect(q).toContain('für das Produkt:');
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
