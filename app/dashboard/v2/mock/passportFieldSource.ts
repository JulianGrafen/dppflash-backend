import type { PassportFieldSourceAttribution } from './types';

export const SOURCE_KIND_LABELS: Record<PassportFieldSourceAttribution['kind'], string> = {
  pdf: 'PDF',
  word: 'Word',
  excel: 'Excel',
  image: 'Bild',
  sap_s4: 'SAP S/4HANA API',
  api: 'REST API',
};

/** Demo-Herkunft pro PassPer-Schlüssel (Editor Audit-Trail Mock). */
export const PASSPORT_FIELD_AUDIT_SEED: Record<string, PassportFieldSourceAttribution> = {
  'battery.passportIdentifier': {
    kind: 'pdf',
    documentTitle: 'EU-Konformitätserklärung_VoltStride.pdf',
    documentId: 'doc-eu-doc-2025',
    locationLabel: 'Seite 1, Kopfbereich',
    pageNumber: 1,
    contextSnippet:
      'Battery passport identifier (DIN 6.1.2.1): PowerCell Pro NMC 5.2 kWh Modul — commercial designation for market placement.',
    excerptBefore:
      '… Product family documentation (EU 2023/1542). ',
    excerptAfter: ' Issued Rheinwerk Cycles GmbH, Köln.',
  },
  'battery.uniqueId': {
    kind: 'sap_s4',
    documentTitle: 'SAP S/4HANA — Materialstamm MM03',
    documentId: 'sap-mm-voltstride-720',
    locationLabel: 'GET /sap/opu/odata/sap/API_PRODUCT_SRV/A_Product(\'VS-720-DE\')',
    contextSnippet: '"ProductUUID": "7c9e6679-7425-40de-944b-e07fc1f90ae7"',
    excerptBefore: '{ "Product": "VS-720-DE", ',
    excerptAfter: ', "Plant": "DE01" }',
  },
  'battery.manufacturer': {
    kind: 'word',
    documentTitle: 'Lieferantenstammdaten_Rheinwerk.docx',
    documentId: 'doc-supplier-master',
    locationLabel: 'Abschnitt 2.1 — Hersteller',
    contextSnippet: 'Responsible economic operator: Rheinwerk Cycles GmbH, Köln, Deutschland.',
  },
  'battery.weight': {
    kind: 'excel',
    documentTitle: 'BOM_VoltStride_720_v3.xlsx',
    documentId: 'doc-bom-xlsx',
    locationLabel: 'Tabellenblatt „Pack_Mass“, Zelle D14',
    contextSnippet: 'Gesamtmasse Pack (kg): 4,1',
    excerptBefore: 'Zellblock | 2,35 kg | … | ',
    excerptAfter: ' | BMS 0,42 kg',
  },
  'performance.nominalEnergy': {
    kind: 'pdf',
    documentTitle: 'Typenschild_Scan_PACK-720.pdf',
    documentId: 'doc-nameplate',
    locationLabel: 'Seite 1, Kennzeichnungsfeld',
    pageNumber: 1,
    contextSnippet: 'Nominal energy: 0,72 kWh (720 Wh) @ 48 V DC',
  },
  'carbonFootprint.total': {
    kind: 'pdf',
    documentTitle: 'ISO14067_CarbonStudy_VoltStride.pdf',
    documentId: 'doc-cf-study',
    locationLabel: 'Seite 12, Ergebnistabelle',
    pageNumber: 12,
    contextSnippet: 'Total carbon footprint (cradle-to-gate): 58 kg CO₂e per battery system.',
  },
  'carbonFootprint.performanceClass': {
    kind: 'pdf',
    documentTitle: 'ISO14067_CarbonStudy_VoltStride.pdf',
    documentId: 'doc-cf-study',
    locationLabel: 'Seite 12, Fußnote',
    pageNumber: 12,
    contextSnippet: 'Performance class vs. benchmark cohort: B',
  },
  'durability.stateOfHealth': {
    kind: 'api',
    documentTitle: 'Telemetrie — Authorized Service Portal',
    documentId: 'api-telemetry-soh',
    locationLabel: 'GET /api/v1/batteries/VS-720-DE-00421/diagnostics',
    contextSnippet: '"stateOfHealthPercent": 82, "source": "workshop_diag_2025-09"',
  },
  'durability.capacityFade': {
    kind: 'excel',
    documentTitle: 'Aging_Test_Protocol_Lab.xlsx',
    documentId: 'doc-aging-xlsx',
    locationLabel: 'Sheet „Cycle_Results“, Zeile 48',
    contextSnippet: 'Capacity fade after 500 cycles (%): 4,2',
  },
  'durability.powerFade': {
    kind: 'excel',
    documentTitle: 'Aging_Test_Protocol_Lab.xlsx',
    documentId: 'doc-aging-xlsx',
    locationLabel: 'Sheet „Cycle_Results“, Zeile 49',
    contextSnippet: 'Power fade after 500 cycles (%): 3,1',
  },
  'manufacturing.place': {
    kind: 'image',
    documentTitle: 'Werksfoto_Montagelinie_Koeln.jpg',
    documentId: 'doc-plant-photo',
    locationLabel: 'EXIF + OCR-Overlay „Plant Köln“',
    contextSnippet: 'Manufacturing place: Köln, Deutschland (OCR confidence 0.94)',
  },
};

export function resolvePassportFieldSource(
  fieldKey: string,
  state: { value: string; provenance: string },
): PassportFieldSourceAttribution | undefined {
  if (!state.value?.trim()) {
    return undefined;
  }
  if (state.provenance === 'confirmed' || state.provenance === 'empty') {
    return PASSPORT_FIELD_AUDIT_SEED[fieldKey];
  }
  const seeded = PASSPORT_FIELD_AUDIT_SEED[fieldKey];
  if (seeded) {
    return seeded;
  }
  if (state.provenance !== 'ai') {
    return undefined;
  }
  return {
    kind: 'pdf',
    documentTitle: 'Wizard_Upload_Bundle.pdf',
    documentId: 'doc-wizard-fallback',
    locationLabel: 'Automatische Extraktion (RAG-Chunk)',
    pageNumber: 1,
    contextSnippet: state.value.trim(),
    excerptBefore: '… ',
    excerptAfter: ' …',
  };
}

export function attachAuditSourcesToPassportFields<
  T extends { value: string; provenance: string; source?: PassportFieldSourceAttribution },
>(fields: Record<string, T>): Record<string, T> {
  const next: Record<string, T> = { ...fields };
  for (const [key, state] of Object.entries(next)) {
    const source = resolvePassportFieldSource(key, state);
    if (source) {
      next[key] = { ...state, source };
    }
  }
  return next;
}
