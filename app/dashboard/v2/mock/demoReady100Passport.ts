import {
  PASSPORT_FIELD_DEFINITIONS,
  isMandatoryField,
  type PassportFieldDefinition,
} from '@/app/domain/battery/passportFieldCatalog';
import { buildVoltstridePassportFieldSeed } from '@/app/domain/battery/voltstrideFieldSeed';
import {
  DEMO_READY_100_ID,
  DEMO_READY_100_PRODUCT_NAME,
} from '@/app/fixtures/demoReady100PublicPassport';
import { fieldSupportsLocalization } from '@/app/dashboard/v2/mock/passportFieldLocalization';
import { attachAuditSourcesToPassportFields } from '@/app/dashboard/v2/mock/passportFieldSource';
import type { DraftField, DraftPassport, PassportFieldValueState } from '@/app/dashboard/v2/mock/types';

const DEMO_READY_SKU = 'DEMO-READY-100';
const DEMO_READY_EAN = '4260123456100';

function demoIdentifierFields(): DraftField[] {
  return [
    {
      path: 'productNumber',
      label: 'Produktnummer / SKU',
      block: 'identification',
      value: DEMO_READY_SKU,
      provenance: 'confirmed',
      confidence: 1,
      critical: true,
    },
    {
      path: 'gtin',
      label: 'GTIN',
      block: 'identification',
      value: DEMO_READY_EAN,
      provenance: 'confirmed',
      confidence: 1,
      critical: false,
    },
  ];
}

export const DEMO_READY_100_DRAFT_ID = 'draft-demo-ready-100';

function demoScalarValue(def: PassportFieldDefinition): string {
  switch (def.datatype) {
    case 'BOOLEAN':
      return 'true';
    case 'DATE':
      return '2025-06-15';
    case 'NUMBER':
    case 'QUANTITY':
      return '100';
    case 'URL':
      return 'https://example.dppflash.demo/compliance/demo-ready-100.pdf';
    case 'ENUM':
      return 'Compliant';
    default:
      return `Demo · ${def.label}`;
  }
}

function demoEnglishValue(def: PassportFieldDefinition, de: string): string {
  if (def.datatype === 'URL') {
    return de;
  }
  if (def.datatype === 'DATE') {
    return de;
  }
  if (def.datatype === 'BOOLEAN') {
    return de;
  }
  if (def.datatype === 'NUMBER' || def.datatype === 'QUANTITY') {
    return de;
  }
  return `${de} (EN)`;
}

/** All 110 PassPer fields filled and confirmed — 100 % editor readiness. */
export function buildDemoReady100PassportFields(): Record<string, PassportFieldValueState> {
  const seed = buildVoltstridePassportFieldSeed();
  const out: Record<string, PassportFieldValueState> = {};

  for (const def of PASSPORT_FIELD_DEFINITIONS) {
    let value = seed[def.key]?.trim() || demoScalarValue(def);
    if (def.key === 'battery.passportIdentifier') {
      value = DEMO_READY_100_ID;
    }

    const localized = fieldSupportsLocalization(def);
    const valueDe = localized ? value : undefined;
    const valueEn = localized ? demoEnglishValue(def, value) : undefined;

    out[def.key] = {
      value,
      valueDe,
      valueEn,
      provenance: 'confirmed',
      confidence: 1,
      mandatory: isMandatoryField(def),
    };
  }

  return attachAuditSourcesToPassportFields(out);
}

export function createDemoReady100Draft(): DraftPassport {
  const now = new Date().toISOString();
  return {
    id: DEMO_READY_100_DRAFT_ID,
    productName: DEMO_READY_100_PRODUCT_NAME,
    status: 'review',
    createdAt: now,
    updatedAt: now,
    creationMethod: 'manual',
    visitedSteps: ['upload', 'review-data', 'gaps', 'check', 'publish'],
    documents: [],
    fields: demoIdentifierFields(),
    passportFields: buildDemoReady100PassportFields(),
    publishedPassId: DEMO_READY_100_ID,
  };
}
