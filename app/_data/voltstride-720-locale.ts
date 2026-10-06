import type { DppPassMaterialOrigin, DppPassSectionId } from '@/app/_data/sample-dpp.data';
import type { PassLocale, PassUiStrings } from '@/lib/pass-locale';

import { VOLTSTRIDE_FIELD_EN, VOLTSTRIDE_FIELD_FR } from './voltstride-720-field-i18n';

export type PassFieldTranslation = {
  label?: string;
  value?: string;
  groupHeading?: string;
  listItems?: DppPassMaterialOrigin[];
};

export type VoltstridePassOverlay = {
  category?: string;
  shortDescription?: string;
  batteryStatusNote?: string;
  cycleLife?: string;
  carbonFootprintUnit?: string;
  carbonPerformanceNote?: string;
  dataAsOf?: string;
  imageAlt?: string;
  profileStatusHint?: string;
  recyclability?: string;
  warranty?: string;
  publicSectionTitle?: string;
  accessSectionTitle?: string;
  sections: Partial<
    Record<DppPassSectionId, { title?: string; headerActionLabel?: string }>
  >;
  fieldGroups: Record<string, string>;
  compositionSegments: string[];
  compositionMaterials: Array<{ label?: string; recycled?: string }>;
  fields: Record<string, PassFieldTranslation>;
};

const UI_DE: PassUiStrings = {
  language: 'Sprache',
  passId: 'Pass-Kennung',
  searchAria: 'Pass durchsuchen',
  searchPlaceholder: 'Angaben durchsuchen …',
  noResults: 'Keine Treffer für „{query}“.',
  fieldsCount: '{count} Angaben',
  kpiAria: 'Kernkennzahlen',
  kpiCapacity: 'Kapazität',
  kpiCycles: 'Ladezyklen',
  kpiCo2: 'CO₂e',
  heroCapacity: 'Kapazität',
  heroCapacityAria: 'Kapazität',
  massDistribution: 'Massenverteilung ({total} kg gesamt)',
  massLegendAria: 'Legende Massenverteilung',
  compositionDetails: 'Details',
  chemistryHeading: 'Chemie & Stoffe',
  recycledHeading: 'Recycelter Anteil',
  materialsHeading: 'Relevante Materialien',
  materialColumn: 'Material',
  shareColumn: 'Anteil',
  recycledColumn: 'Recycelt',
  yes: 'Ja',
  no: 'Nein',
  footerEuTitle: 'Digitaler Produktpass (EU)',
  footerHosted: 'Gehostet mit',
  footerSandbox: 'Zur Sandbox',
  issuerNote:
    'Ausgestellt gemäß Verordnung (EU) 2023/1542, Art. 77 und Anhang XIII. Die Angaben stammen vom Herausgeber; verifizierte Felder sind in der Pass-Akte belegt.',
  dataAsOfPrefix: 'Stand:',
  viewAction: 'Ansehen',
  downloadAction: 'Download',
  carbonPerformanceClassLabel: 'Leistungsklasse',
  carbonPerformanceClassAria: 'CO₂-Leistungsklasse {grade}',
};

const UI_EN: PassUiStrings = {
  language: 'Language',
  passId: 'Pass identification',
  searchAria: 'Search passport',
  searchPlaceholder: 'Search fields …',
  noResults: 'No results for “{query}”.',
  fieldsCount: '{count} fields',
  kpiAria: 'Key metrics',
  kpiCapacity: 'Capacity',
  kpiCycles: 'Charge cycles',
  kpiCo2: 'CO₂e',
  heroCapacity: 'Capacity',
  heroCapacityAria: 'Capacity',
  massDistribution: 'Mass distribution ({total} kg total)',
  massLegendAria: 'Mass distribution legend',
  compositionDetails: 'Details',
  chemistryHeading: 'Chemistry & substances',
  recycledHeading: 'Recycled content',
  materialsHeading: 'Relevant materials',
  materialColumn: 'Material',
  shareColumn: 'Share',
  recycledColumn: 'Recycled',
  yes: 'Yes',
  no: 'No',
  footerEuTitle: 'Digital product passport (EU)',
  footerHosted: 'Hosted with',
  footerSandbox: 'Open sandbox',
  issuerNote:
    'Issued under Regulation (EU) 2023/1542, Art. 77 and Annex XIII. Data is provided by the issuer; verified fields are evidenced in the passport record.',
  dataAsOfPrefix: 'As of:',
  viewAction: 'View',
  downloadAction: 'Download',
  carbonPerformanceClassLabel: 'Performance class',
  carbonPerformanceClassAria: 'Carbon performance class {grade}',
};

const UI_FR: PassUiStrings = {
  language: 'Langue',
  passId: 'Identification du passeport',
  searchAria: 'Rechercher dans le passeport',
  searchPlaceholder: 'Rechercher des données …',
  noResults: 'Aucun résultat pour « {query} ».',
  fieldsCount: '{count} données',
  kpiAria: 'Indicateurs clés',
  kpiCapacity: 'Capacité',
  kpiCycles: 'Cycles de charge',
  kpiCo2: 'CO₂e',
  heroCapacity: 'Capacité',
  heroCapacityAria: 'Capacité',
  massDistribution: 'Répartition des masses ({total} kg au total)',
  massLegendAria: 'Légende de répartition des masses',
  compositionDetails: 'Détails',
  chemistryHeading: 'Chimie et substances',
  recycledHeading: 'Contenu recyclé',
  materialsHeading: 'Matériaux pertinents',
  materialColumn: 'Matériau',
  shareColumn: 'Part',
  recycledColumn: 'Recyclé',
  yes: 'Oui',
  no: 'Non',
  footerEuTitle: 'Passeport produit numérique (UE)',
  footerHosted: 'Hébergé avec',
  footerSandbox: 'Vers la sandbox',
  issuerNote:
    'Émis conformément au règlement (UE) 2023/1542, art. 77 et annexe XIII. Les données proviennent de l’émetteur ; les champs vérifiés sont justifiés dans le dossier du passeport.',
  dataAsOfPrefix: 'En date du :',
  viewAction: 'Voir',
  downloadAction: 'Télécharger',
  carbonPerformanceClassLabel: 'Classe de performance',
  carbonPerformanceClassAria: 'Classe de performance carbone {grade}',
};

const VALUE_EN: Record<string, string> = {
  'battery.status': 'In use',
  'label:Produkt': 'VoltStride Pack 720 · Li-ion LFP · LMT',
  'label:Produktfamilie':
    'Li-ion LFP battery for e-bikes (LMT), modular repair, compliant for the EU market.',
  'label:Reparaturkonzept': 'Modular cell packs · EU service partners',
  'label:Demontage': '6 screws · 2×7 cells',
  'label:Ersatzteilverfügbarkeit': '10 years (manufacturer commitment)',
  'dynamic.dataSource': 'BMS telemetry · authorised service (demo)',
  'dynamic.capacityRetention': '82% of rated capacity',
  'dueDiligence.report': 'View',
  'dueDiligence.policyUrl': 'View',
  'conformity.euDeclaration': 'Download',
  'label:Zertifizierungen': 'Download',
  'label:CE-Kennzeichnung': 'Yes · from 03/2025',
  'carbonFootprint.studyRef': 'Download',
};

const VALUE_FR: Record<string, string> = {
  'battery.status': 'En service',
  'label:Produkt': 'VoltStride Pack 720 · Li-ion LFP · LMT',
  'label:Produktfamilie':
    'Batterie Li-ion LFP pour vélos électriques (LMT), réparation modulaire, conforme au marché UE.',
  'label:Reparaturkonzept': 'Packs modulaires · partenaires service UE',
  'label:Demontage': '6 vis · 2×7 cellules',
  'label:Ersatzteilverfügbarkeit': '10 ans (engagement fabricant)',
  'dynamic.dataSource': 'Télémétrie BMS · service agréé (démo)',
  'dynamic.capacityRetention': '82 % de la capacité nominale',
  'dueDiligence.report': 'Voir',
  'dueDiligence.policyUrl': 'Voir',
  'conformity.euDeclaration': 'Télécharger',
  'label:Zertifizierungen': 'Télécharger',
  'label:CE-Kennzeichnung': 'Oui · dès 03/2025',
  'carbonFootprint.studyRef': 'Télécharger',
};

function mergeFields(
  labels: Record<string, { label?: string; value?: string }>,
  values: Record<string, string>,
): Record<string, PassFieldTranslation> {
  const out: Record<string, PassFieldTranslation> = {};
  for (const [id, entry] of Object.entries(labels)) {
    out[id] = { label: entry.label, value: values[id] };
  }
  return out;
}

const OVERLAY_EN: VoltstridePassOverlay = {
  category: 'LMT battery',
  shortDescription:
    'Li-ion LFP pack for e-bikes (LMT), 720 Wh rated energy — modular repair, EU-market compliant.',
  batteryStatusNote: 'Live · updated by authorised repair partner',
  cycleLife: '≥ 1,000 cycles',
  carbonFootprintUnit: 'CO₂e (cradle-to-gate)',
  carbonPerformanceNote:
    'Class B: approx. 15% below the median of comparable Li-ion LFP packs (demo).',
  dataAsOf: 'March 2025',
  imageAlt: 'VoltStride e-bike battery, 48 V lithium-ion',
  profileStatusHint: 'Demo profile · LMT battery passport',
  recyclability: '70% of mass',
  warranty: '5 years / ≥ 1,000 cycles',
  publicSectionTitle: 'Public data under the EU Battery Regulation',
  accessSectionTitle: 'Access via role-based query',
  sections: {
    summary: { title: 'Summary' },
    composition: { title: 'Composition' },
    repairability: {
      title: 'Repair',
      headerActionLabel: 'Find repair partner',
    },
    carbon: { title: 'Carbon footprint' },
    endOfLife: { title: 'End of life' },
    documents: { title: 'Evidence & documents' },
    technical: { title: 'Technical data' },
  },
  fieldGroups: {
    'technical-dynamic': 'Operating data',
    'summary-identity': 'Identity & manufacturing',
    'summary-durability': 'Durability',
    'summary-performance': 'Performance & electrical',
    'summary-labelling': 'Labelling',
    'carbon-detail': 'Methodology & study',
    'recycled-content': 'Recycled content',
    'eol-detail': 'End-of-life notes',
  },
  compositionSegments: [
    'Li-ion LFP cell block',
    'Housing & protection',
    'BMS & connectors',
  ],
  compositionMaterials: [
    { label: 'Lithium' },
    { label: 'Copper' },
    { label: 'Aluminium' },
    { label: 'Iron / phosphate (LFP)' },
    { label: 'Graphite' },
    { label: 'Electrolyte (Li salt)' },
  ],
  fields: mergeFields(VOLTSTRIDE_FIELD_EN, VALUE_EN),
};

const OVERLAY_FR: VoltstridePassOverlay = {
  category: 'Batterie LMT',
  shortDescription:
    'Pack Li-ion LFP pour vélos électriques (LMT), 720 Wh d’énergie nominale — réparation modulaire, conforme au marché UE.',
  batteryStatusNote: 'En direct · mis à jour par un réparateur agréé',
  cycleLife: '≥ 1 000 cycles',
  carbonFootprintUnit: 'CO₂e (du berceau à la sortie d’usine)',
  carbonPerformanceNote:
    'Classe B : env. 15 % sous la médiane des packs Li-ion LFP comparables (démo).',
  dataAsOf: 'mars 2025',
  imageAlt: 'Batterie vélo VoltStride, lithium-ion 48 V',
  profileStatusHint: 'Profil démo · passeport batterie LMT',
  recyclability: '70 % de la masse',
  warranty: '5 ans / ≥ 1 000 cycles',
  publicSectionTitle: 'Données publiques selon le règlement batteries UE',
  accessSectionTitle: 'Accès via requête par rôle',
  sections: {
    summary: { title: 'Résumé' },
    composition: { title: 'Composition' },
    repairability: {
      title: 'Réparation',
      headerActionLabel: 'Trouver un partenaire réparation',
    },
    carbon: { title: 'Empreinte carbone' },
    endOfLife: { title: 'Fin de vie' },
    documents: { title: 'Preuves et documents' },
    technical: { title: 'Données techniques' },
  },
  fieldGroups: {
    'technical-dynamic': 'Données d’exploitation',
    'summary-identity': 'Identité et fabrication',
    'summary-durability': 'Durabilité',
    'summary-performance': 'Performance et électrique',
    'summary-labelling': 'Étiquetage',
    'carbon-detail': 'Méthodologie et étude',
    'recycled-content': 'Contenu recyclé',
    'eol-detail': 'Notes fin de vie',
  },
  compositionSegments: [
    'Bloc cellules Li-ion LFP',
    'Boîtier et protection',
    'BMS et connecteurs',
  ],
  compositionMaterials: [
    { label: 'Lithium' },
    { label: 'Cuivre' },
    { label: 'Aluminium' },
    { label: 'Fer / phosphate (LFP)' },
    { label: 'Graphite' },
    { label: 'Électrolyte (sel Li)' },
  ],
  fields: mergeFields(VOLTSTRIDE_FIELD_FR, VALUE_FR),
};

export function getVoltstride720Ui(locale: PassLocale): PassUiStrings {
  if (locale === 'en') return UI_EN;
  if (locale === 'fr') return UI_FR;
  return UI_DE;
}

export function getVoltstride720PassOverlay(
  locale: PassLocale,
): VoltstridePassOverlay | null {
  if (locale === 'en') return OVERLAY_EN;
  if (locale === 'fr') return OVERLAY_FR;
  return null;
}
