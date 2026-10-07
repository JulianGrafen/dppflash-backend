import type { PassportFieldDefinition } from '@/app/domain/battery/passportFieldCatalog';
import type { PassportFieldValueState } from './types';

const LOCALIZED_DATATYPES = new Set(['STRING', 'TEXT list', 'TEXT']);

export function fieldSupportsLocalization(def: PassportFieldDefinition): boolean {
  return LOCALIZED_DATATYPES.has(def.datatype as string);
}

export function fieldValueDe(state: PassportFieldValueState): string {
  return state.valueDe ?? state.value ?? '';
}

export function fieldValueEn(state: PassportFieldValueState): string {
  return state.valueEn ?? '';
}

export function fieldValueForContentLocale(
  state: PassportFieldValueState,
  locale: 'de' | 'en',
): string {
  return locale === 'en' ? fieldValueEn(state) : fieldValueDe(state);
}

export function passportFieldHasValue(
  state: PassportFieldValueState,
  def: PassportFieldDefinition,
): boolean {
  if (state.provenance === 'missing') {
    return false;
  }
  if (fieldSupportsLocalization(def)) {
    return Boolean(fieldValueDe(state).trim()) && Boolean(fieldValueEn(state).trim());
  }
  return Boolean(state.value?.trim());
}

export function localizedFieldMissingLocales(
  state: PassportFieldValueState,
  def: PassportFieldDefinition,
): ('de' | 'en')[] {
  if (!fieldSupportsLocalization(def)) {
    return [];
  }
  const missing: ('de' | 'en')[] = [];
  if (!fieldValueDe(state).trim()) {
    missing.push('de');
  }
  if (!fieldValueEn(state).trim()) {
    missing.push('en');
  }
  return missing;
}
