import type { ProductPassport } from '@/app/types/dpp-types';

/**
 * Felder die beim DPP-Erstellen aus RAG/Eager (`products.extracted_attributes`)
 * ins Produktpass übernommen werden („Quellen & Belege“).
 * Andere Keys (z. B. gtin, productName) bleiben aus dieser Schicht unberührt.
 */
export const RAG_SOURCES_AND_EVIDENCE_PASSPORT_KEYS = new Set<string>([
  'hersteller',
  'modellname',
  'ewcCode',
  'wasteCode',
  'endOfLifeInstructions',
  'chemicalComposition',
  'materialZusammensetzung',
  'substancesOfConcern',
  'gefahrenstoffe',
  /** CLP-/ESPR-Produktkennzeichnung aus Eager-Extraktion */
  'upi',
  'hStatements',
  'ghsSymbols',
  /** CHEMICAL/PAINT — gleicher Speicher-Slot wie chemicalComposition (Synonym-Merge). */
  'zusammensetzung',
  'entsorgungshinweise',
]);

const PENDING_GTIN = 'PENDING_EXTERNAL_MATCH';

/** True when the passport has no usable GTIN yet (RAG should treat gtin as high priority). */
export function isPassportGtinMissing(passport: Record<string, unknown>): boolean {
  const g = passport.gtin;
  if (g === undefined || g === null) {
    return true;
  }
  if (typeof g !== 'string') {
    return false;
  }
  const t = g.trim();
  return t === '' || t === PENDING_GTIN;
}

/** Puts `gtin` first in the forensic target list when no GTIN is on the passport yet. */
export function orderRagTargetKeysPrioritizingGtin(
  keys: readonly string[],
  passport: Record<string, unknown>,
): readonly string[] {
  const k = [...keys];
  if (!isPassportGtinMissing(passport)) {
    return k;
  }
  const gi = k.indexOf('gtin');
  if (gi <= 0) {
    return k;
  }
  k.splice(gi, 1);
  k.unshift('gtin');
  return k;
}

/** Gemeinsame RAG-Ziele: ESPR zeigt u.a. `wasteCode`, ältere Pässe `ewcCode`; Merge setzt nur noch leere Felder. */
const COMMON = [
  'hersteller',
  'modellname',
  'gtin',
  'upi',
  'ewcCode',
  'wasteCode',
  'productName',
  'declaredProductType',
  'countryOfOrigin',
  'countryOfManufacturing',
  'endOfLifeInstructions',
  'materialComposition',
  'chemicalComposition',
] as const;

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
  'gefahrenstoffe',
  'verwendung',
  'lagerbedingungen',
  'entsorgungshinweise',
  'sicherheitsdatenblatt',
  'hStatements',
  'ghsSymbols',
] as const;

const PAINT = [
  ...COMMON,
  'zusammensetzung',
  'gefahrenstoffe',
  'verwendung',
  'lagerbedingungen',
  'entsorgungshinweise',
  'voc',
  'hStatements',
  'ghsSymbols',
] as const;

const LUBRICANT = [
  ...COMMON,
  'zusammensetzung',
  'gefahrenstoffe',
  'viskositaet',
  'temperaturbereich',
  'umweltfreundlichkeit',
  'verwendungsbereich',
  'hStatements',
  'ghsSymbols',
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
    case 'PAINT':
      return [...PAINT];
    case 'LUBRICANT':
      return [...LUBRICANT];
    default:
      return [...COMMON];
  }
}

/** Union all product-type keys for eager background extraction (single LLM pass per PDF). */
export function getAllRagExtractionFieldKeys(): readonly string[] {
  return [
    ...new Set<string>([
      ...COMMON,
      ...BATTERY,
      ...TEXTILE,
      ...ELECTRONICS,
      ...FURNITURE,
      ...CHEMICAL,
      ...PAINT,
      ...LUBRICANT,
    ]),
  ];
}
