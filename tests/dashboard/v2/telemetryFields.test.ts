import { describe, expect, it } from 'vitest';
import { PASSPORT_FIELD_DEFINITIONS } from '@/app/domain/battery/passportFieldCatalog';
import {
  categoryPrefixForField,
  isTelemetryPassportField,
} from '@/app/dashboard/v2/passports/[draftId]/editor/telemetryFields';

describe('telemetryFields', () => {
  it('splits dynamic durability fields into telemetry group', () => {
    const soh = PASSPORT_FIELD_DEFINITIONS.find((d) => d.key === 'durability.stateOfHealth');
    const fade = PASSPORT_FIELD_DEFINITIONS.find((d) => d.key === 'durability.capacityFade');
    expect(soh && isTelemetryPassportField(soh)).toBe(true);
    expect(soh && categoryPrefixForField(soh)).toBe('telemetry');
    expect(fade && isTelemetryPassportField(fade)).toBe(false);
    expect(fade && categoryPrefixForField(fade)).toBe('durability');
  });
});
