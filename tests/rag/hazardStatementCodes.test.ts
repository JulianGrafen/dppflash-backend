import { describe, expect, it } from 'vitest';
import {
  extractHazardStatementCodesFromText,
  normalizeHazardStatementCodeList,
} from '@/app/domain/rag/hazardStatementCodes';

describe('hazardStatementCodes', () => {
  it('extracts H codes from classification text', () => {
    expect(extractHazardStatementCodesFromText('STOT SE 3, H335, Skin Irrit. 2, H315')).toEqual([
      'H335',
      'H315',
    ]);
  });

  it('normalizes arrays and filters non-H tokens', () => {
    expect(normalizeHazardStatementCodeList(['H302', 'foo', 'H315, H317'])).toEqual(['H302', 'H315', 'H317']);
  });
});
