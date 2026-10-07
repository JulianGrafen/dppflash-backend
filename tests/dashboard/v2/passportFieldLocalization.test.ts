import { describe, expect, it } from 'vitest';
import { PASSPORT_FIELD_DEFINITIONS } from '@/app/domain/battery/passportFieldCatalog';
import {
  fieldSupportsLocalization,
  passportFieldHasValue,
} from '@/app/dashboard/v2/mock/passportFieldLocalization';
import type { PassportFieldValueState } from '@/app/dashboard/v2/mock/types';

describe('passportFieldLocalization', () => {
  const stringDef = PASSPORT_FIELD_DEFINITIONS.find((d) => d.datatype === 'STRING')!;

  it('requires both locales for STRING fields', () => {
    const base: PassportFieldValueState = {
      value: 'Nur DE Fallback',
      valueDe: 'Nur DE Fallback',
      provenance: 'ai',
      confidence: 0.9,
      mandatory: true,
    };
    expect(fieldSupportsLocalization(stringDef)).toBe(true);
    expect(passportFieldHasValue(base, stringDef)).toBe(false);
    expect(
      passportFieldHasValue({ ...base, valueEn: 'English copy' }, stringDef),
    ).toBe(true);
  });
});
