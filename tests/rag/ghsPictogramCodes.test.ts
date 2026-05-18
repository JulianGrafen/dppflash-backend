import { describe, expect, it } from 'vitest';
import {
  inferGhsPictogramsFromHStatements,
  normalizeGhsPictogramCode,
  normalizeGhsPictogramCodeList,
} from '@/app/domain/rag/ghsPictogramCodes';

describe('ghsPictogramCodes', () => {
  it('normalizes numeric and short string codes', () => {
    expect(normalizeGhsPictogramCode(5)).toBe('GHS05');
    expect(normalizeGhsPictogramCode('07')).toBe('GHS07');
    expect(normalizeGhsPictogramCode('GHS 5')).toBe('GHS05');
  });

  it('deduplicates and sorts code lists', () => {
    expect(normalizeGhsPictogramCodeList([7, 'GHS05', '05'])).toEqual(['GHS05', 'GHS07']);
  });

  it('infers pictograms from H-statements when images missing', () => {
    expect(inferGhsPictogramsFromHStatements(['H314', 'H315'])).toContain('GHS05');
    expect(inferGhsPictogramsFromHStatements(['H314', 'H315'])).toContain('GHS07');
  });
});
