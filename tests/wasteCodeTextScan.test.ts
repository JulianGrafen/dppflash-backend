import { describe, expect, it } from 'vitest';
import { findFirstEuropeanWasteCodeInText } from '@/app/application/services/wasteCodeTextScan';

describe('findFirstEuropeanWasteCodeInText', () => {
  it('detects spaced EWC with asterisk', () => {
    const t = 'Entsorgung: Abfallschlüssel 08 04 09* gemäß AVV.';
    const hit = findFirstEuropeanWasteCodeInText(t);
    expect(hit?.snippet).toContain('08');
    expect(hit?.normalizedValue).toMatch(/08\s04\s09\*?$/);
  });

  it('detects dashed form', () => {
    const hit = findFirstEuropeanWasteCodeInText('Code 13-02-12* für Altöl');
    expect(hit?.snippet).toBeTruthy();
  });

  it('detects glued six digits with mandatory star', () => {
    const hit = findFirstEuropeanWasteCodeInText('080409*');
    expect(hit?.snippet).toBe('080409*');
  });
});
