import { describe, expect, it } from 'vitest';
import {
  PASSPORT_FIELD_AUDIT_SEED,
  resolvePassportFieldSource,
} from '@/app/dashboard/v2/mock/passportFieldSource';

describe('passportFieldSource', () => {
  it('returns seeded SAP attribution for unique battery id', () => {
    const source = resolvePassportFieldSource('battery.uniqueId', {
      value: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
      provenance: 'ai',
    });
    expect(source?.kind).toBe('sap_s4');
    expect(source?.documentTitle).toContain('SAP');
  });

  it('returns undefined for empty values', () => {
    expect(
      resolvePassportFieldSource('durability.capacityFade', { value: '', provenance: 'empty' }),
    ).toBeUndefined();
  });

  it('includes capacity fade excel source in seed', () => {
    expect(PASSPORT_FIELD_AUDIT_SEED['durability.capacityFade']?.kind).toBe('excel');
  });
});
