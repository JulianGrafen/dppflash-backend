import type { BatteryDPP } from '@/app/types/dpp-types';

export const DEMO_BATTERY_PUBLIC_ID = 'battery-demo-public';

/**
 * Showcase battery passport — same UI density as Cimsec chemical demo, public Tier-1 traceability only.
 */
export function createDemoBatteryPublicPassport(): BatteryDPP {
  return {
    id: DEMO_BATTERY_PUBLIC_ID,
    type: 'BATTERY',
    createdAt: new Date('2026-03-15T10:00:00.000Z'),
    language: 'de',
    traceabilityMaxPublicTier: 1,

    productName: 'PowerCell Pro NMC 5.2 kWh Modul',
    modellname: 'PowerCell Pro NMC 5.2',
    hersteller:
      'TechVolt Energy Systems GmbH\nIndustriestraße 14\n40549 Düsseldorf\nDeutschland',
    manufacturer: {
      name: 'TechVolt Energy Systems GmbH',
      address: 'Industriestraße 14, 40549 Düsseldorf',
      country: 'DE',
      phone: '+49 211 555 0140',
      email: 'dpp@techvolt-example.de',
      website: 'https://example.techvolt-energy.de',
    },
    countryOfOrigin: 'Deutschland',
    countryOfManufacturing: 'Deutschland',
    complianceStatus: 'COMPLIANT',

    gtin: '4260123456789',
    sku: 'TV-NMC-52-001',
    upi: 'TV-NMC-52-001',

    kapazitaetKWh: 5.2,
    chemischesSystem: 'Lithium-Ionen (NMC 622)',
    batterietyp: 'Stationärer Energiespeicher-Modul',
    nennspannungV: 51.2,
    gewichtKg: 42.5,
    seriennummer: 'SN-DEMO-2026-004821',
    produktionsdatum: new Date('2026-02-10'),

    co2FussabdruckKgGesamt: 118.4,
    co2FussabdruckKgProKwh: 22.8,
    carbonFootprint: {
      totalKg: 118.4,
      perKwhKg: 22.8,
      methodology: 'Cradle-to-gate (Modul, ohne Installation)',
      certificationBody: 'TÜV SÜD (Demo)',
    },
    environmentalImpact: {
      waterFootprintLiters: 12400,
      impactNotes: 'Schätzung auf Basis Branchenbenchmark NMC-Stationär (Showcase).',
    },

    recyclinganteilKobalt: 16,
    recyclinganteilLithium: 6,
    recyclinganteilNickel: 12,
    erwarteteLebensdauerLadezyklen: 6000,
    reparierbarkeitsIndex: 7.2,
    ersatzteileVerfuegbarkeitJahre: 10,
    recyclingAnweisungen:
      'Modul nur durch zertifizierten Recycler demontieren. Li-Ion gemäß UN 3480 — keine Hausmüllentsorgung.',
    entsorgungshinweise: 'EAK 16 06 05* — Batterien und Akkumulatoren.',
    wasteCode: '16 06 05*',

    zertifizierungsstelle: 'TÜV SÜD Product Service (Demo)',
    referenznummer: 'EU 2023/1542 (Battery Regulation)',
    regulatoryReference: 'Verordnung (EU) 2023/1542 — Batterien und Altbatterien',
    rechtlicheHinweise:
      'Transportklassifizierung UN 3480 (Lithium-Ionen-Batterien). Pass-Daten bis 2041 verfügbar (Demo).',

    materialComposition: [
      { material: 'Nickel (Kathode, NMC)', percentage: 22 },
      { material: 'Kobalt (Kathode, NMC)', percentage: 8 },
      { material: 'Lithium (Elektrolyt / Kathode)', percentage: 6 },
      { material: 'Graphit (Anode)', percentage: 18 },
      { material: 'Kupfer (Stromsammler)', percentage: 12 },
      { material: 'Aluminium (Gehäuse & Kühlplatte)', percentage: 14 },
      { material: 'Sonstige Komponenten (Binder, Separator)', percentage: 20 },
    ],

    supplierAndProcessInformation: [
      {
        level: 'Tier-1 Rohstoff',
        supplierName: 'Nordic Cathode Materials AB',
        supplierCountry: 'SE',
        processName: 'NMC-Pulver',
        processDescription: 'Kobalt-Nickel-Mangan-Kathodenmaterial (öffentliche Tier-1-Angabe).',
      },
      {
        level: 'Tier-1 Rohstoff',
        supplierName: 'Graphite Nordic AS',
        supplierCountry: 'NO',
        processName: 'Anodengraphit',
        processDescription: 'Synthetischer Graphit für Li-Ion-Anode.',
      },
    ],

    attachments: [
      {
        title: 'Technisches Datenblatt — PowerCell Pro NMC 5.2',
        url: 'https://example.techvolt-energy.de/docs/powercell-pro-nmc-52-datasheet.pdf',
        type: 'regulatory_data_sheet',
      },
      {
        title: 'Konformitätserklärung — EU Battery Regulation (Demo)',
        url: 'https://example.techvolt-energy.de/docs/powercell-eu-conformity-demo.pdf',
        type: 'regulatory_data_sheet',
      },
    ],
  };
}
