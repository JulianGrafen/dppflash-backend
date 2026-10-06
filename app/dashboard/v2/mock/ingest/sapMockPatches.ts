import { MOCK_SAP_BATTERY_ODATA } from '../sapConnectFixture';
import type { IngestPatchMap } from './types';

const SAP_DOC_ID = 'sap-onboarding-mm03';

export function buildSapMockPatches(sapHost?: string): IngestPatchMap {
  const host = sapHost?.trim() || 'sap.example.corp';
  const product = MOCK_SAP_BATTERY_ODATA.d;

  return {
    'battery.uniqueId': {
      value: String(product.Product),
      confidence: 0.97,
      provenance: 'confirmed',
      source: {
        kind: 'sap_s4',
        documentTitle: 'SAP S/4HANA — Materialstamm MM03',
        documentId: SAP_DOC_ID,
        locationLabel: `GET https://${host}/sap/opu/odata/sap/API_PRODUCT_SRV/A_Product('${product.Product}')`,
        contextSnippet: `"Product": "${product.Product}"`,
      },
    },
    'battery.manufacturer': {
      value: 'TechVolt Energy Systems GmbH',
      confidence: 0.95,
      provenance: 'confirmed',
      source: {
        kind: 'sap_s4',
        documentTitle: 'SAP S/4HANA — Materialstamm MM03',
        documentId: SAP_DOC_ID,
        locationLabel: 'Plant / Manufacturer party',
        contextSnippet: 'Manufacturer: TechVolt Energy Systems GmbH',
      },
    },
    'operator.responsibleOperatorId': {
      value: 'DE1234567890123',
      confidence: 0.94,
      provenance: 'confirmed',
      source: {
        kind: 'sap_s4',
        documentTitle: 'SAP S/4HANA — Business Partner',
        documentId: SAP_DOC_ID,
        locationLabel: 'EOID / EORI',
        contextSnippet: 'Responsible economic operator id: DE1234567890123',
      },
    },
    'manufacturing.place': {
      value: 'Köln, Deutschland',
      confidence: 0.93,
      provenance: 'confirmed',
      source: {
        kind: 'sap_s4',
        documentTitle: 'SAP S/4HANA — Plant master',
        documentId: SAP_DOC_ID,
        locationLabel: `CountryOfOrigin: ${product.CountryOfOrigin}`,
        contextSnippet: 'Manufacturing place: Köln, Deutschland',
      },
    },
    'battery.weight': {
      value: String(product.NetWeight),
      confidence: 0.96,
      provenance: 'confirmed',
      source: {
        kind: 'sap_s4',
        documentTitle: 'SAP S/4HANA — Materialstamm MM03',
        documentId: SAP_DOC_ID,
        locationLabel: `NetWeight (${product.WeightUnit})`,
        contextSnippet: `NetWeight: ${product.NetWeight} ${product.WeightUnit}`,
      },
    },
    'performance.certifiedUsableEnergy': {
      value: '5.2',
      confidence: 0.91,
      provenance: 'ai',
      source: {
        kind: 'sap_s4',
        documentTitle: 'SAP S/4HANA — Classification',
        documentId: SAP_DOC_ID,
        locationLabel: 'Characteristic NOM_ENERGY_KWH',
        contextSnippet: 'Certified usable energy (kWh): 5.2',
      },
    },
    'carbonFootprint.total': {
      value: '58',
      confidence: 0.9,
      provenance: 'ai',
      source: {
        kind: 'sap_s4',
        documentTitle: 'SAP S/4HANA — Sustainability footprint',
        documentId: SAP_DOC_ID,
        locationLabel: 'CF_TOTAL_KG_CO2E',
        contextSnippet: 'Carbon footprint total: 58 kg CO₂e',
      },
    },
  };
}
