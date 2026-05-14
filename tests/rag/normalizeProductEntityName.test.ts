import { describe, expect, it } from 'vitest';
import { normalizeProductEntityName } from '@/app/domain/rag/normalizeProductEntityName';

describe('normalizeProductEntityName', () => {
  it('lowercases, strips punctuation, collapses spaces', () => {
    expect(normalizeProductEntityName('Cimsec S1 Flex!')).toBe('cimsec s1 flex');
  });

  it('handles diacritics', () => {
    expect(normalizeProductEntityName('Kärcher K 2')).toBe('karcher k 2');
  });

  it('returns empty for noise-only input', () => {
    expect(normalizeProductEntityName('!!!')).toBe('');
  });
});
