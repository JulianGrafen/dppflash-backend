import catalogJson from './passport-field-catalog.json';

export type PassportFieldDatatype =
  | 'STRING'
  | 'DATE'
  | 'ENUM'
  | 'QUANTITY'
  | 'NUMBER'
  | 'TEXT list'
  | 'URL'
  | 'BOOLEAN';

export type PassportFieldAccessTier = 'Public' | 'Authorities only' | 'Legitimate interest';

export type PassportFieldStatus = 'Mandatory' | 'Recommended' | 'Optional';

export type PassportFieldDefinition = {
  key: string;
  label: string;
  note: string;
  datatype: PassportFieldDatatype;
  accessTier: PassportFieldAccessTier;
  status: PassportFieldStatus;
};

export type PassportSectionId =
  | 'identity'
  | 'compliance'
  | 'carbon'
  | 'supplyChain'
  | 'materials'
  | 'repair'
  | 'recycled'
  | 'endOfLife'
  | 'performance'
  | 'durability';

export type PassportSectionDefinition = {
  id: PassportSectionId;
  title: string;
  description: string;
  prefixes: readonly string[];
};

const PREFIX_TO_SECTION: Record<string, PassportSectionId> = {
  battery: 'identity',
  operator: 'identity',
  manufacturing: 'identity',
  labelling: 'compliance',
  conformity: 'compliance',
  compliance: 'compliance',
  carbonFootprint: 'carbon',
  dueDiligence: 'supplyChain',
  material: 'materials',
  hazardous: 'materials',
  repair: 'repair',
  recycledContent: 'recycled',
  renewableContent: 'recycled',
  endOfLife: 'endOfLife',
  performance: 'performance',
  durability: 'durability',
};

export const PASSPORT_SECTIONS: readonly PassportSectionDefinition[] = [
  {
    id: 'identity',
    title: 'Identität & Herstellung',
    description: 'Art. 77 / DIN 6.1 — Identifikation, Hersteller, Fertigung.',
    prefixes: ['battery', 'operator', 'manufacturing'],
  },
  {
    id: 'compliance',
    title: 'Compliance & Kennzeichnung',
    description: 'Konformität, Kennzeichnung und regulatorische Nachweise.',
    prefixes: ['labelling', 'conformity', 'compliance'],
  },
  {
    id: 'carbon',
    title: 'CO₂-Fußabdruck',
    description: 'Kohlenstoff-Fußabdruck und Leistungsklasse.',
    prefixes: ['carbonFootprint'],
  },
  {
    id: 'supplyChain',
    title: 'Lieferkette',
    description: 'Due Diligence und Lieferketten-Nachweise.',
    prefixes: ['dueDiligence'],
  },
  {
    id: 'materials',
    title: 'Materialien & Gefahrstoffe',
    description: 'Zusammensetzung, kritische Rohstoffe, Gefahrstoffe.',
    prefixes: ['material', 'hazardous'],
  },
  {
    id: 'repair',
    title: 'Reparatur',
    description: 'Reparierbarkeit, Demontage, Ersatzteile.',
    prefixes: ['repair'],
  },
  {
    id: 'recycled',
    title: 'Recycelte Inhalte',
    description: 'Recyclingquoten und erneuerbare Inhaltsstoffe.',
    prefixes: ['recycledContent', 'renewableContent'],
  },
  {
    id: 'endOfLife',
    title: 'Lebensende',
    description: 'Sammlung, Zweitnutzung, Nutzerhinweise.',
    prefixes: ['endOfLife'],
  },
  {
    id: 'performance',
    title: 'Leistung',
    description: 'Elektrische Kennwerte und Leistungsdaten.',
    prefixes: ['performance'],
  },
  {
    id: 'durability',
    title: 'Haltbarkeit & Telemetrie',
    description: 'Lebensdauer, SoH/SoC und dynamische Betriebsdaten.',
    prefixes: ['durability'],
  },
];

type CatalogFile = {
  fields: PassportFieldDefinition[];
  counts: { total: number };
};

const catalog = catalogJson as CatalogFile;

export const PASSPORT_FIELD_DEFINITIONS: readonly PassportFieldDefinition[] = catalog.fields;

export function getPassportFieldPrefix(key: string): string {
  return key.split('.')[0] ?? key;
}

export function getSectionIdForFieldKey(key: string): PassportSectionId {
  const prefix = getPassportFieldPrefix(key);
  const section = PREFIX_TO_SECTION[prefix];
  if (!section) {
    return 'identity';
  }
  return section;
}

export function getFieldsForSection(sectionId: PassportSectionId): PassportFieldDefinition[] {
  const section = PASSPORT_SECTIONS.find((s) => s.id === sectionId);
  if (!section) {
    return [];
  }
  const prefixes = new Set(section.prefixes);
  return PASSPORT_FIELD_DEFINITIONS.filter((f) => prefixes.has(getPassportFieldPrefix(f.key)));
}

export function isMandatoryField(def: PassportFieldDefinition): boolean {
  return def.status === 'Mandatory';
}

export const PASSPORT_FIELD_COUNT = PASSPORT_FIELD_DEFINITIONS.length;
