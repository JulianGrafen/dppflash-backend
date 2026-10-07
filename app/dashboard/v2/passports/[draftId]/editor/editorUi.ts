import type { PassportFieldAccessTier } from '@/app/domain/battery/passportFieldCatalog';
import type { EditorPassportLocale } from '@/app/domain/battery/passportFieldI18n';

export function sectionProgressTone(filled: number, total: number, missingMandatory: number): string {
  if (total === 0) {
    return 'bg-slate-200';
  }
  if (missingMandatory > 0) {
    return 'bg-amber-400';
  }
  if (filled >= total) {
    return 'bg-emerald-500';
  }
  return 'bg-sky-500';
}

export function accessTierShort(tier: PassportFieldAccessTier): string {
  if (tier === 'Public') {
    return 'P';
  }
  if (tier === 'Authorities only') {
    return 'A';
  }
  return 'L';
}

const CATEGORY_LABELS_EN: Record<string, string> = {
  battery: 'Battery',
  operator: 'Operator',
  manufacturing: 'Manufacturing',
  labelling: 'Labelling',
  conformity: 'Conformity',
  compliance: 'Compliance',
  carbonFootprint: 'Carbon footprint',
  dueDiligence: 'Due diligence',
  material: 'Material composition',
  hazardous: 'Hazardous substances',
  repair: 'Repair',
  recycledContent: 'Recycled content',
  renewableContent: 'Renewable content',
  endOfLife: 'End of life',
  performance: 'Performance',
  durability: 'Durability',
  telemetry: 'Telemetry (dynamic)',
};

const CATEGORY_LABELS_DE: Record<string, string> = {
  battery: 'Batterie',
  operator: 'Wirtschaftsbeteiligter',
  manufacturing: 'Herstellung',
  labelling: 'Kennzeichnung',
  conformity: 'Konformität',
  compliance: 'Compliance',
  carbonFootprint: 'CO₂-Fußabdruck',
  dueDiligence: 'Sorgfaltspflicht',
  material: 'Materialzusammensetzung',
  hazardous: 'Gefahrstoffe',
  repair: 'Reparatur',
  recycledContent: 'Recycelte Inhalte',
  renewableContent: 'Erneuerbare Inhalte',
  endOfLife: 'Lebensende',
  performance: 'Leistung',
  durability: 'Haltbarkeit',
  telemetry: 'Telemetrie (dynamisch)',
};

export function categoryGroupLabel(prefix: string, locale: EditorPassportLocale = 'en'): string {
  const labels = locale === 'de' ? CATEGORY_LABELS_DE : CATEGORY_LABELS_EN;
  return labels[prefix] ?? prefix;
}

export function sectionNavLabel(title: string): string {
  const short: Record<string, string> = {
    'Identität & Herstellung': 'Identity',
    'Compliance & Kennzeichnung': 'Compliance',
    'CO₂-Fußabdruck': 'Carbon footprint',
    Lieferkette: 'Supply chain',
    'Materialien & Gefahrstoffe': 'Composition & materials',
    Reparatur: 'Repair',
    'Recycelte Inhalte': 'Recycled content',
    Lebensende: 'End of life',
    Leistung: 'Performance',
    'Haltbarkeit & Telemetrie': 'Durability',
  };
  return short[title] ?? title;
}
