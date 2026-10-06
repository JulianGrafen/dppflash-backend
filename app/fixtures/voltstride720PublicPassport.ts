import type { BatteryDPP } from '@/app/types/dpp-types';

export const VOLTSTRIDE_720_ID = 'voltstride-720';

/** Public showcase — aligned with https://dppflash.de/p/voltstride-720/ */
export function createVoltstride720PublicPassport(): BatteryDPP {
  return {
    id: VOLTSTRIDE_720_ID,
    type: 'BATTERY',
    createdAt: new Date('2026-03-01T10:00:00.000Z'),
    language: 'de',
    traceabilityMaxPublicTier: 1,
    productName: 'VoltStride 720',
    modellname: 'VoltStride Pack 720',
    hersteller: 'Rheinwerk Cycles GmbH',
    manufacturer: {
      name: 'Rheinwerk Cycles GmbH',
      address: 'Köln, Deutschland',
      country: 'DE',
    },
    countryOfOrigin: 'Deutschland',
    countryOfManufacturing: 'Deutschland',
    complianceStatus: 'COMPLIANT',
    batterietyp: 'LMT-Batterie',
    chemischesSystem: 'Li-ion LFP (NMC-frei)',
    kapazitaetKWh: 0.72,
    gewichtKg: 4.1,
    nennspannungV: 48,
    seriennummer: 'VS-720-DE-00421',
    produktionsdatum: new Date('2025-03-01'),
    co2FussabdruckKgGesamt: 58,
    carbonFootprint: {
      totalKg: 58,
      perKwhKg: 80.6,
      methodology: 'ISO 14067 (Demo)',
      performanceClass: 'B',
      systemBoundary: 'Cradle-to-Gate',
    },
    recyclinganteilLithium: 18,
    recyclinganteilKobalt: 0,
    recyclinganteilNickel: 0,
    erwarteteLebensdauerLadezyklen: 1000,
    reparierbarkeitsIndex: 8,
    ersatzteileVerfuegbarkeitJahre: 10,
    recyclingAnweisungen:
      'EU-Batterie-Rücknahme (Händler/Recycler) · Second-life nur nach Diagnose.',
    entsorgungshinweise: 'Nur über autorisierte Sammelstellen / Händler abgeben.',
    zertifizierungsstelle: 'EU-Konformitätserklärung (Demo)',
    referenznummer: 'Regulation (EU) 2023/1542',
    materialComposition: [
      { material: 'Zellblock Li-ion LFP', percentage: 57 },
      { material: 'Gehäuse & Schutz', percentage: 24 },
      { material: 'BMS & Anschlüsse', percentage: 19 },
    ],
    supplierAndProcessInformation: [
      {
        level: 'Tier-1 Rohstoff',
        supplierName: 'Nordic Cathode Materials',
        supplierCountry: 'SE',
        processName: 'LFP-Kathode',
        processDescription: 'Kathodenmaterial für E-Bike-Pack (Demo).',
      },
    ],
    /** Editor / telemetry overlay fields used by mapper */
    passportFieldOverlay: {
      'battery.passportIdentifier': 'voltstride-720',
      'battery.uniqueId': '7c9e6679-7425-40de-944b-e07fc1f90ae7',
      'operator.responsibleOperatorId': 'DE1234567890123',
      'battery.manufacturer': 'Rheinwerk Cycles GmbH',
      'manufacturing.place': 'Köln, Deutschland',
      'battery.manufacturingDate': '2025-03',
      'battery.commissioningDate': '2025-04',
      'battery.warrantyPeriod': '5 Jahre / ≥ 1.000 Zyklen',
      'battery.category': 'LMT',
      'battery.weight': '4.1',
      'battery.status': 'In use',
      'durability.stateOfHealth': '82',
      'performance.nominalEnergy': '0.72',
      'performance.nominalCapacity': '15',
      'carbonFootprint.total': '58',
      'carbonFootprint.performanceClass': 'B',
    },
    attachments: [
      {
        title: 'EU-Konformitätserklärung',
        url: 'https://example.dppflash.de/docs/voltstride-eu-doc.pdf',
        type: 'regulatory_data_sheet',
      },
    ],
  };
}
