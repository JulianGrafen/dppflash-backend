import type { PassportFieldDefinition } from './passportFieldCatalog';
import deLabels from './passport-field-i18n.de.json';

export type EditorPassportLocale = 'de' | 'en';

type DeEntry = { label: string; note?: string };

const DE_BY_KEY = deLabels as Record<string, DeEntry>;

export function passportFieldLabel(def: PassportFieldDefinition, locale: EditorPassportLocale): string {
  if (locale === 'en') {
    return def.label;
  }
  return DE_BY_KEY[def.key]?.label ?? def.label;
}

export function passportFieldNote(def: PassportFieldDefinition, locale: EditorPassportLocale): string {
  if (locale === 'en') {
    return def.note;
  }
  return DE_BY_KEY[def.key]?.note ?? def.note;
}
