import { describe, expect, it } from 'vitest';

import { WasteCodeService } from '@/app/application/services/WasteCodeService';

describe('WasteCodeService', () => {
  it('normalizes multiple spellings of 08 04 09* to the mapped hazardous code', () => {
    const variants = ['08 04 09*', '08 04 09 ', '080409', '08 04 09'];

    for (const variant of variants) {
      const resolution = WasteCodeService.resolve(variant);

      expect(resolution.normalizedCode).toBe('08 04 09*');
      expect(resolution.found).toBe(true);
      expect(resolution.hazardous).toBe(true);
      expect(resolution.instruction).toContain('Gefaehrlicher Abfall');
    }
  });

  it('returns a fallback instruction when a code is unknown', () => {
    const resolution = WasteCodeService.resolve('99 99 99');

    expect(resolution.found).toBe(false);
    expect(resolution.instruction).toContain('manuelle Pruefung durch die Fachabteilung');
  });
});
