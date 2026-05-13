import type { ProductPassport } from '@/app/types/dpp-types';

const COMMON = ['hersteller', 'modellname', 'gtin', 'ewcCode'] as const;

const BATTERY = [
  ...COMMON,
  'chemischesSystem',
  'batterietyp',
  'seriennummer',
  'kapazitaetKWh',
  'nennspannungV',
  'gewichtKg',
  'referenznummer',
  'recyclingAnweisungen',
  'zertifizierungsstelle',
  'rechtlicheHinweise',
  'co2FussabdruckKgGesamt',
  'co2FussabdruckKgProKwh',
  'recyclinganteilKobalt',
  'recyclinganteilLithium',
  'recyclinganteilNickel',
  'erwarteteLebensdauerLadezyklen',
  'reparierbarkeitsIndex',
  'ersatzteileVerfuegbarkeitJahre',
] as const;

const TEXTILE = [
  ...COMMON,
  'materialZusammensetzung',
  'herkunftsland',
  'verarbeitungsland',
  'pflegehinweise',
  'nachhaltigkeit',
] as const;

const ELECTRONICS = [
  ...COMMON,
  'produkttyp',
  'stromverbrauch',
  'energieeffizienzklasse',
  'lebensdauer',
  'reparierbarkeit',
  'updatefrequenz',
  'sicherheitsmerkmale',
] as const;

const FURNITURE = [...COMMON, 'material', 'abmessungen', 'gewicht', 'zerlegbarkeit', 'nachhaltigkeitszertifikat'] as const;

const CHEMICAL = [
  ...COMMON,
  'zusammensetzung',
  'verwendung',
  'lagerbedingungen',
  'entsorgungshinweise',
  'sicherheitsdatenblatt',
] as const;

/**
 * Passport keys the forensic RAG step may try to populate (only from indexed chunks).
 */
export function getRagTargetFieldKeysForProductType(
  type: ProductPassport['type'],
): readonly string[] {
  switch (type) {
    case 'BATTERY':
      return [...BATTERY];
    case 'TEXTILE':
      return [...TEXTILE];
    case 'ELECTRONICS':
      return [...ELECTRONICS];
    case 'FURNITURE':
      return [...FURNITURE];
    case 'CHEMICAL':
      return [...CHEMICAL];
    default:
      return [...COMMON];
  }
}
