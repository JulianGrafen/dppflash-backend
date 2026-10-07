import { describe, expect, it } from 'vitest';
import { PASSPORT_FIELD_DEFINITIONS } from '@/app/domain/battery/passportFieldCatalog';
import { passportFieldLabel } from '@/app/domain/battery/passportFieldI18n';
import deLabels from '@/app/domain/battery/passport-field-i18n.de.json';

describe('passportFieldI18n', () => {
  it('provides German labels for all catalog fields', () => {
    expect(Object.keys(deLabels)).toHaveLength(PASSPORT_FIELD_DEFINITIONS.length);
    const sample = PASSPORT_FIELD_DEFINITIONS.find((d) => d.key === 'battery.uniqueId')!;
    expect(passportFieldLabel(sample, 'de')).toBe('Eindeutige Batteriekennung');
    expect(passportFieldLabel(sample, 'en')).toBe(sample.label);
  });
});
