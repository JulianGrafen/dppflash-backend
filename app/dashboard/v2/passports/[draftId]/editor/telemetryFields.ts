import type { PassportFieldDefinition } from '@/app/domain/battery/passportFieldCatalog';

const TELEMETRY_FIELD_KEYS = new Set([
  'durability.stateOfHealth',
  'durability.usageData',
]);

/** Runtime / BMS fields: catalog "(dynamic)" notes plus Annex XIII individual-battery fields. */
export function isTelemetryPassportField(def: PassportFieldDefinition): boolean {
  if (!def.key.startsWith('durability.')) {
    return false;
  }
  return TELEMETRY_FIELD_KEYS.has(def.key) || def.note.includes('(dynamic)');
}

export function categoryPrefixForField(def: PassportFieldDefinition): string {
  if (isTelemetryPassportField(def)) {
    return 'telemetry';
  }
  return def.key.split('.')[0] ?? def.key;
}
