import type { DraftField, DraftPassport } from './types';
import { computeCompleteness } from './completeness';
import { defaultPublishedPassId, initializePassportFieldsFromCatalog } from './passportFields';

function field(
  partial: Omit<DraftField, 'confidence'> & { confidence?: number },
): DraftField {
  return {
    confidence: partial.confidence ?? 0.92,
    ...partial,
  };
}

export function createEmptyDraft(id: string, creationMethod: DraftPassport['creationMethod']): DraftPassport {
  const now = new Date().toISOString();
  return {
    id,
    productName: 'Neuer Produktpass',
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    creationMethod,
    visitedSteps: ['upload'],
    documents: [],
    fields: [],
    passportFields: initializePassportFieldsFromCatalog(),
    publishedPassId: defaultPublishedPassId(),
  };
}

export function buildFieldsAfterExtraction(): DraftField[] {
  return [
    field({
      path: 'productName',
      label: 'Produktname',
      block: 'identification',
      value: 'PowerCell Pro NMC 5.2 kWh Modul',
      provenance: 'ai',
      confidence: 0.96,
      critical: true,
    }),
    field({
      path: 'manufacturer',
      label: 'Hersteller',
      block: 'identification',
      value: 'TechVolt Energy Systems GmbH',
      provenance: 'ai',
      confidence: 0.94,
      critical: true,
    }),
    field({
      path: 'productNumber',
      label: 'Produktnummer / SKU',
      block: 'identification',
      value: 'TV-NMC-52-001',
      provenance: 'ai',
      confidence: 0.71,
      critical: true,
    }),
    field({
      path: 'gtin',
      label: 'GTIN',
      block: 'identification',
      value: '4260123456789',
      provenance: 'ai',
      confidence: 0.68,
      critical: false,
    }),
    field({
      path: 'materialComposition',
      label: 'Materialzusammensetzung (Detail)',
      block: 'materials',
      value: null,
      provenance: 'missing',
      confidence: 0,
      critical: true,
      supplierHint: 'Nordic Cathode Materials AB',
      supplierEmail: 'dpp@nordic-cathode.example',
    }),
    field({
      path: 'materials.summary',
      label: 'Materialien (erkannt)',
      block: 'materials',
      value: 'NMC, Graphit, Kupfer, Aluminium, Lithium',
      provenance: 'ai',
      confidence: 0.88,
      critical: false,
    }),
    field({
      path: 'recycling.cobalt',
      label: 'Recyclinganteil Kobalt',
      block: 'recycling',
      value: '16 %',
      provenance: 'ai',
      confidence: 0.9,
      critical: false,
    }),
    field({
      path: 'recycling.lithium',
      label: 'Recyclinganteil Lithium',
      block: 'recycling',
      value: null,
      provenance: 'missing',
      confidence: 0,
      critical: false,
    }),
    field({
      path: 'origin.country',
      label: 'Ursprungsland',
      block: 'origin',
      value: 'Deutschland',
      provenance: 'ai',
      confidence: 0.93,
      critical: true,
    }),
    field({
      path: 'origin.supplier',
      label: 'Lieferant Tier-1 (Kathode)',
      block: 'origin',
      value: 'Nordic Cathode Materials AB (SE)',
      provenance: 'ai',
      confidence: 0.75,
      critical: false,
      supplierHint: 'Nordic Cathode Materials AB',
      supplierEmail: 'dpp@nordic-cathode.example',
    }),
    field({
      path: 'technical.capacity',
      label: 'Kapazität',
      block: 'technical',
      value: '5.2 kWh',
      provenance: 'ai',
      confidence: 0.97,
      critical: true,
    }),
    field({
      path: 'technical.chemistry',
      label: 'Chemisches System',
      block: 'technical',
      value: 'Lithium-Ionen (NMC 622)',
      provenance: 'ai',
      confidence: 0.95,
      critical: false,
    }),
    field({
      path: 'technical.voltage',
      label: 'Nennspannung',
      block: 'technical',
      value: '51.2 V',
      provenance: 'ai',
      confidence: 0.82,
      critical: false,
    }),
    field({
      path: 'repair.info',
      label: 'Reparaturinformationen',
      block: 'recycling',
      value: null,
      provenance: 'missing',
      confidence: 0,
      critical: false,
    }),
    field({
      path: 'cert.euBattery',
      label: 'EU Battery Regulation',
      block: 'certificates',
      value: 'Verordnung (EU) 2023/1542 — Konformitätserklärung im Anhang',
      provenance: 'ai',
      confidence: 0.91,
      critical: true,
    }),
    field({
      path: 'cert.datasheet',
      label: 'Technisches Datenblatt',
      block: 'certificates',
      value: 'powercell-pro-nmc-52-datasheet.pdf',
      provenance: 'ai',
      confidence: 0.99,
      critical: false,
    }),
  ];
}

export function applyExtractionToDraft(draft: DraftPassport): DraftPassport {
  const fields = buildFieldsAfterExtraction();
  const summary = computeCompleteness(fields);
  const base =
    draft.passportFields && Object.keys(draft.passportFields).length > 0
      ? { ...draft.passportFields }
      : initializePassportFieldsFromCatalog();
  const passportFields = { ...base };
  passportFields['battery.manufacturer'] = {
    ...passportFields['battery.manufacturer'],
    value: passportFields['battery.manufacturer']?.value?.trim() || 'TechVolt Energy Systems GmbH',
    provenance: passportFields['battery.manufacturer']?.value?.trim() ? passportFields['battery.manufacturer'].provenance : 'ai',
    confidence: passportFields['battery.manufacturer']?.confidence ?? 0.94,
  };
  passportFields['battery.uniqueId'] = {
    ...passportFields['battery.uniqueId'],
    value: passportFields['battery.uniqueId']?.value?.trim() || 'SN-DEMO-2026-004821',
    provenance: passportFields['battery.uniqueId']?.value?.trim() ? passportFields['battery.uniqueId'].provenance : 'ai',
    confidence: passportFields['battery.uniqueId']?.confidence ?? 0.96,
  };
  return {
    ...draft,
    productName: 'PowerCell Pro NMC 5.2 kWh Modul',
    updatedAt: new Date().toISOString(),
    fields,
    passportFields,
    visitedSteps: [...new Set([...draft.visitedSteps, 'upload', 'review-data'])],
    status: summary.missingCount > 0 ? 'draft' : 'review',
  };
}
