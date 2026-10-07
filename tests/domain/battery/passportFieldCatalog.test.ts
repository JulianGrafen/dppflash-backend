import { describe, expect, it } from 'vitest';
import {
  PASSPORT_FIELD_COUNT,
  PASSPORT_FIELD_DEFINITIONS,
  PASSPORT_SECTIONS,
  getFieldsForSection,
} from '@/app/domain/battery/passportFieldCatalog';

describe('passportFieldCatalog', () => {
  it('loads 110 fields', () => {
    expect(PASSPORT_FIELD_COUNT).toBe(110);
    expect(PASSPORT_FIELD_DEFINITIONS).toHaveLength(110);
  });

  it('assigns every field to a section', () => {
    const assigned = PASSPORT_SECTIONS.flatMap((s) => getFieldsForSection(s.id));
    expect(assigned).toHaveLength(110);
    const keys = new Set(assigned.map((f) => f.key));
    expect(keys.size).toBe(110);
  });
});
