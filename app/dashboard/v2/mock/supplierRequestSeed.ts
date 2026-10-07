import { suggestedSupplierForPassportField } from '@/app/dashboard/v2/lib/passportSupplierHints';
import { supplierRowsFromDrafts } from '@/app/dashboard/v2/lib/loadSupplierRows';
import { applyExtractionToDraft, createEmptyDraft } from './batteryWizardFixture';
import { ensurePassportFieldsOnDraft } from './passportFields';
import { saveAllDrafts } from './storage';
import type { DraftField, DraftPassport, PassportFieldValueState } from './types';

export const VOLTSTRIDE_SUPPLIER_DRAFT_ID = 'voltstride-720';

const MIN_DEFAULT_SUPPLIER_ROWS = 4;

/** PassPer-Felder mit offener Lieferantenanfrage (Demo). */
const MOCK_PASSPORT_FIELD_KEYS = [
  'battery.uniqueId',
  'operator.economicOperatorId',
  'manufacturing.place',
  'carbonFootprint.total',
] as const;

const MOCK_LEGACY_PENDING_PATHS = ['materialComposition', 'repair.info'] as const;

const MOCK_SENT_OFFSETS_MS = [
  5 * 24 * 60 * 60 * 1000,
  3 * 24 * 60 * 60 * 1000,
  2 * 24 * 60 * 60 * 1000,
  36 * 60 * 60 * 1000,
  18 * 60 * 60 * 1000,
  6 * 60 * 60 * 1000,
] as const;

function mockSentAt(index: number): string {
  const offset = MOCK_SENT_OFFSETS_MS[index % MOCK_SENT_OFFSETS_MS.length];
  return new Date(Date.now() - offset).toISOString();
}

function legacySupplierForPath(path: string): Pick<DraftField, 'supplierHint' | 'supplierEmail'> {
  if (path === 'repair.info') {
    return {
      supplierHint: 'Label Solutions EU GmbH',
      supplierEmail: 'labels@label-solutions.example',
    };
  }
  return {
    supplierHint: 'Nordic Cathode Materials AB',
    supplierEmail: 'dpp@nordic-cathode.example',
  };
}

function patchPassportSupplierMocks(
  passportFields: Record<string, PassportFieldValueState>,
): Record<string, PassportFieldValueState> {
  const next = { ...passportFields };
  MOCK_PASSPORT_FIELD_KEYS.forEach((key, index) => {
    const current = next[key];
    if (!current || current.provenance === 'pending_supplier') {
      return;
    }
    const supplier = suggestedSupplierForPassportField(key);
    next[key] = {
      ...current,
      provenance: 'pending_supplier',
      supplierHint: current.supplierHint ?? supplier.supplierHint,
      supplierEmail: current.supplierEmail ?? supplier.supplierEmail,
      supplierSentAt: current.supplierSentAt ?? mockSentAt(index),
    };
  });
  return next;
}

function patchLegacySupplierMocks(fields: DraftField[]): DraftField[] {
  const byPath = new Map(fields.map((f) => [f.path, f]));

  const patched = fields.map((field) => {
    if (!MOCK_LEGACY_PENDING_PATHS.includes(field.path as (typeof MOCK_LEGACY_PENDING_PATHS)[number])) {
      return field;
    }
    if (field.provenance === 'pending_supplier') {
      return field;
    }
    const supplier = legacySupplierForPath(field.path);
    const index = MOCK_LEGACY_PENDING_PATHS.indexOf(field.path as (typeof MOCK_LEGACY_PENDING_PATHS)[number]);
    return {
      ...field,
      provenance: 'pending_supplier' as const,
      supplierHint: field.supplierHint ?? supplier.supplierHint,
      supplierEmail: field.supplierEmail ?? supplier.supplierEmail,
      supplierSentAt: field.supplierSentAt ?? mockSentAt(MOCK_PASSPORT_FIELD_KEYS.length + index),
    };
  });

  for (const path of MOCK_LEGACY_PENDING_PATHS) {
    if (byPath.has(path)) {
      continue;
    }
    const supplier = legacySupplierForPath(path);
    const index = MOCK_LEGACY_PENDING_PATHS.indexOf(path);
    patched.push({
      path,
      label:
        path === 'materialComposition'
          ? 'Materialzusammensetzung (Detail)'
          : 'Reparaturinformationen',
      block: path === 'materialComposition' ? 'materials' : 'recycling',
      value: null,
      provenance: 'pending_supplier',
      confidence: 0,
      critical: path === 'materialComposition',
      supplierHint: supplier.supplierHint,
      supplierEmail: supplier.supplierEmail,
      supplierSentAt: mockSentAt(MOCK_PASSPORT_FIELD_KEYS.length + index),
    });
  }

  return patched;
}

export function createVoltstrideSupplierSeedDraft(): DraftPassport {
  const base = createEmptyDraft(VOLTSTRIDE_SUPPLIER_DRAFT_ID, 'import');
  const extracted = applyExtractionToDraft({
    ...base,
    productName: 'VoltStride 720',
    publishedPassId: VOLTSTRIDE_SUPPLIER_DRAFT_ID,
  });
  const passportFields = patchPassportSupplierMocks(ensurePassportFieldsOnDraft(extracted));
  const fields = patchLegacySupplierMocks(extracted.fields);
  return {
    ...extracted,
    passportFields,
    fields,
    updatedAt: new Date().toISOString(),
  };
}

function mergeSupplierMocksIntoDraft(draft: DraftPassport): DraftPassport {
  const passportFields = patchPassportSupplierMocks(
    ensurePassportFieldsOnDraft(draft),
  );
  const fields = patchLegacySupplierMocks(draft.fields);
  return {
    ...draft,
    passportFields,
    fields,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Stellt Demo-Lieferantenanfragen bereit, wenn noch keine (oder zu wenige) in den Entwürfen sind.
 */
export function ensureSupplierRequestMocks(drafts: DraftPassport[]): DraftPassport[] {
  if (supplierRowsFromDrafts(drafts).length >= MIN_DEFAULT_SUPPLIER_ROWS) {
    return drafts;
  }

  const voltstride = drafts.find((d) => d.id === VOLTSTRIDE_SUPPLIER_DRAFT_ID);
  const seeded = voltstride
    ? mergeSupplierMocksIntoDraft(voltstride)
    : createVoltstrideSupplierSeedDraft();

  const next = voltstride
    ? drafts.map((d) => (d.id === VOLTSTRIDE_SUPPLIER_DRAFT_ID ? seeded : d))
    : [seeded, ...drafts];

  if (supplierRowsFromDrafts(next).length < MIN_DEFAULT_SUPPLIER_ROWS) {
    return drafts;
  }

  saveAllDrafts(next);
  return next;
}
