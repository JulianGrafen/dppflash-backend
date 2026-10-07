import { describe, expect, it } from 'vitest';
import { PASSPORT_FIELD_DEFINITIONS } from '@/app/domain/battery/passportFieldCatalog';
import { passportFieldEditorNote } from '@/app/domain/battery/passportFieldEditorNote';

describe('passportFieldEditorNote', () => {
  it('hides citation-only DIN / Art notes', () => {
    const def = PASSPORT_FIELD_DEFINITIONS.find((f) => f.note.includes('DIN 6.1.2.4 / Art 38(7)'));
    expect(def).toBeDefined();
    expect(passportFieldEditorNote(def!, 'en')).toBe('');
  });

  it('keeps explanatory text after the normative prefix', () => {
    const def = PASSPORT_FIELD_DEFINITIONS.find((f) => f.key === 'battery.passportIdentifier');
    expect(def).toBeDefined();
    expect(passportFieldEditorNote(def!, 'en')).toContain('unique id');
    expect(passportFieldEditorNote(def!, 'en')).not.toMatch(/^DIN/);
  });
});
