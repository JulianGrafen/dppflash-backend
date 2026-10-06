export type DppRole = 'public' | 'recycler' | 'auditor';

export type DppFieldTier = DppRole;

/** Inhaltliche Gliederung (angelehnt an EU-Pass-Profile, z. B. Passper seed) */
export type DppPassSectionId =
  | 'summary'
  | 'performance'
  | 'composition'
  | 'carbon'
  | 'repairability'
  | 'endOfLife'
  | 'documents'
  | 'dynamic'
  | 'technical';

export interface DppPassMaterialOrigin {
  name: string;
  origin: string;
  /** Massen- oder Materialanteil am Produkt (z. B. „12 %“) */
  share?: string;
}

export interface DppPassField {
  /** Schema-/Resolver-Schlüssel (z. B. performance.temperatureRangeMin) */
  key?: string;
  label: string;
  value: string;
  /** Wenn gesetzt, wird ein Ja/Nein statt `value` angezeigt */
  boolean?: boolean;
  /** Aufzählung mit Ursprungsland (statt `value`) */
  listItems?: DppPassMaterialOrigin[];
  tier?: DppFieldTier;
  href?: string;
  pill?: 'pink' | 'green' | 'orange';
  sectionId: DppPassSectionId;
  /** Felder mit gleicher `group` werden in einem Dropdown gebündelt */
  group?: string;
  /** Unterüberschrift innerhalb einer `group` (z. B. „Leistung“ in Detailansicht) */
  groupHeading?: string;
}

export interface DppPassFieldGroup {
  id: string;
  title: string;
  /** Wert für die geschlossene Zeile (z. B. Produktname) */
  summaryLabel?: string;
}

export interface DppPassContentSection {
  id: DppPassSectionId;
  title: string;
  description?: string;
  /** Ganze Sektionskarte als Aufklapper (z. B. Betriebsdaten) */
  collapsible?: boolean;
  defaultOpen?: boolean;
  /** Link direkt unter der Sektionsüberschrift */
  headerAction?: { label: string; href: string };
}

export interface DppPassSection {
  title: string;
  pillDefault: 'pink' | 'orange';
  fields: DppPassField[];
  fieldGroups?: DppPassFieldGroup[];
}

export interface DppCompositionSegment {
  label: string;
  kg: number;
  percent: number;
  colorClass: string;
}

export interface DppCompositionMaterial {
  label: string;
  share: string;
  recycled?: string;
  tier?: DppFieldTier;
}

export interface DppComposition {
  totalKg: number;
  segments: DppCompositionSegment[];
  materials: DppCompositionMaterial[];
}

export interface SampleDppPass {
  slug: string;
  category: string;
  title: string;
  shortDescription: string;
  batteryId: string;
  /** Öffentliche Pass-UUID (Resolver / QR-Verweis) */
  passUuid: string;
  serialNumber: string;
  weight: string;
  capacity: string;
  /** State of health / Ladezustand für KPI-Balken (0–100) */
  batteryStatusPercent: number;
  batteryStatusNote?: string;
  cycleLife: string;
  carbonFootprint: string;
  carbonFootprintUnit?: string;
  carbonPerformanceClass?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  carbonPerformanceNote?: string;
  dataAsOf: string;
  manufacturer?: string;
  manufacturedDate?: string;
  warranty?: string;
  recyclability?: string;
  profileStatusHint?: string;
  verifiedFieldsCount?: number;
  imageUrl: string;
  imageAlt: string;
  contentSections: DppPassContentSection[];
  composition: DppComposition;
  publicSection: DppPassSection;
  accessSection: DppPassSection;
}

import { VOLTSTRIDE_720_DYNAMIC_FIELDS } from './voltstride-720-dynamic-fields';
import { VOLTSTRIDE_720_PUBLIC_FIELDS } from './voltstride-720-public-fields';

export const SAMPLE_DPP_PASSES: Record<string, SampleDppPass> = {
  'voltstride-720': {
    slug: 'voltstride-720',
    category: 'LMT-Batterie',
    title: 'VoltStride 720',
    shortDescription:
      'Li-ion-LFP-Akku für E-Bikes (LMT), 720 Wh Nennenergie — modular reparierbar, konform für den EU-Markt.',
    batteryId: '0x4a7f…2821',
    passUuid: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    serialNumber: 'VS-720-DE-00421',
    weight: '4,1 kg',
    capacity: '720 Wh',
    batteryStatusPercent: 82,
    batteryStatusNote: 'Live · aktualisiert durch autorisierten Reparaturbetrieb',
    cycleLife: '≥ 1.000 Zyklen',
    carbonFootprint: '58 kg',
    carbonFootprintUnit: 'CO₂e (Cradle-to-Gate)',
    carbonPerformanceClass: 'B',
    carbonPerformanceNote:
      'Klasse B: ca. 15 % unter dem Median vergleichbarer Li-ion-LFP-Akkus (Demo).',
    dataAsOf: 'März 2025',
    manufacturer: 'Rheinwerk Cycles GmbH',
    manufacturedDate: '15.03.2025',
    warranty: '5 Jahre / ≥ 1.000 Zyklen',
    recyclability: '70 % der Masse',
    profileStatusHint: 'Demo-Profil · Batteriepass LMT',
    verifiedFieldsCount: 42,
    imageUrl: '/images/voltstride-720-hero.png',
    imageAlt: 'VoltStride E-Bike-Akku, 48 V Lithium-Ion',
    contentSections: [
      { id: 'summary', title: 'Zusammenfassung' },
      { id: 'composition', title: 'Zusammensetzung' },
      {
        id: 'repairability',
        title: 'Reparatur',
        collapsible: true,
        defaultOpen: false,
        headerAction: {
          label: 'Reparaturpartner finden',
          href: 'https://www.rheinwerk-cycles.de/service-partner',
        },
      },
      { id: 'carbon', title: 'CO₂-Fußabdruck' },
      { id: 'endOfLife', title: 'Lebensende' },
      { id: 'documents', title: 'Nachweise & Dokumente' },
      {
        id: 'technical',
        title: 'Technische Angaben',
        collapsible: true,
        defaultOpen: false,
      },
    ],
    composition: {
      totalKg: 4.1,
      segments: [
        {
          label: 'Zellblock Li-ion LFP',
          kg: 2.35,
          percent: 57,
          colorClass: 'bg-violet-500',
        },
        {
          label: 'Gehäuse & Schutz',
          kg: 1.0,
          percent: 24,
          colorClass: 'bg-slate-400',
        },
        {
          label: 'BMS & Anschlüsse',
          kg: 0.75,
          percent: 19,
          colorClass: 'bg-amber-500',
        },
      ],
      materials: [
        { label: 'Lithium', share: '12 %', recycled: '18 %' },
        { label: 'Kupfer', share: '8 %', recycled: '22 %' },
        { label: 'Aluminium', share: '6 %' },
        { label: 'Eisen / Phosphat (LFP)', share: '18 %' },
        { label: 'Graphit', share: '11 %' },
        {
          label: 'Elektrolyt (Li-Salz)',
          share: '4 %',
          tier: 'recycler',
        },
      ],
    },
    publicSection: {
      title: 'Öffentliche Daten gemäß EU-Batterierichtlinie',
      pillDefault: 'pink',
      fieldGroups: [
        { id: 'technical-dynamic', title: 'Betriebsdaten' },
        { id: 'summary-identity', title: 'Identität & Herstellung' },
        { id: 'summary-durability', title: 'Haltbarkeit' },
        { id: 'summary-performance', title: 'Leistung & elektrisch' },
        { id: 'summary-labelling', title: 'Kennzeichnung' },
        { id: 'carbon-detail', title: 'Methodik & Studie' },
        { id: 'recycled-content', title: 'Recycelter Anteil' },
        { id: 'eol-detail', title: 'Hinweise Lebensende' },
      ],
      fields: [...VOLTSTRIDE_720_PUBLIC_FIELDS, ...VOLTSTRIDE_720_DYNAMIC_FIELDS],
    },
    accessSection: {
      title: 'Zugang über rollenbasierte Abfrage',
      pillDefault: 'orange',
      fields: [
        {
          label: 'Demontage-Sheet',
          value: 'Download',
          href: '#',
          sectionId: 'documents',
          tier: 'recycler',
        },
        {
          label: 'Belegpaket (ESPR)',
          value: 'Export',
          href: '#',
          sectionId: 'documents',
          tier: 'auditor',
        },
      ],
    },
  },
};

export function getSampleDppPass(slug: string): SampleDppPass | undefined {
  return SAMPLE_DPP_PASSES[slug];
}

export function getAllPassFields(pass: SampleDppPass): DppPassField[] {
  return [
    ...(pass.publicSection?.fields ?? []),
    ...(pass.accessSection?.fields ?? []),
  ];
}

const DEFAULT_CONTENT_SECTIONS: DppPassContentSection[] = [
  { id: 'summary', title: 'Zusammenfassung' },
  { id: 'composition', title: 'Zusammensetzung' },
  {
    id: 'repairability',
    title: 'Reparatur',
    collapsible: true,
    defaultOpen: false,
    headerAction: {
      label: 'Reparaturpartner finden',
      href: 'https://www.rheinwerk-cycles.de/service-partner',
    },
  },
  { id: 'carbon', title: 'CO₂-Fußabdruck' },
  { id: 'endOfLife', title: 'Lebensende' },
  { id: 'documents', title: 'Nachweise & Dokumente' },
  {
    id: 'technical',
    title: 'Technische Angaben',
    collapsible: true,
    defaultOpen: false,
  },
];

/** Stellt fehlende Metadaten sicher (z. B. nach Hot-Reload / älterem Cache). */
export function normalizePass(pass: SampleDppPass): SampleDppPass {
  return {
    ...pass,
    carbonFootprintUnit: pass.carbonFootprintUnit ?? 'CO₂e',
    carbonPerformanceClass: pass.carbonPerformanceClass ?? 'C',
    carbonPerformanceNote: pass.carbonPerformanceNote,
    batteryStatusPercent: pass.batteryStatusPercent ?? 0,
    profileStatusHint: pass.profileStatusHint ?? 'Demo-Profil',
    verifiedFieldsCount: pass.verifiedFieldsCount ?? 0,
    recyclability: pass.recyclability ?? '—',
    contentSections:
      pass.contentSections?.length ? pass.contentSections : DEFAULT_CONTENT_SECTIONS,
  };
}
