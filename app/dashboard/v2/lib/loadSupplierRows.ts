import { PASSPORT_FIELD_DEFINITIONS } from '@/app/domain/battery/passportFieldCatalog';
import { ensureSupplierRequestMocks } from '@/app/dashboard/v2/mock/supplierRequestSeed';
import { loadAllDrafts } from '@/app/dashboard/v2/mock/storage';
import type { DraftField, DraftPassport } from '@/app/dashboard/v2/mock/types';
import {
  legacyFieldToSupplierView,
  passportFieldToSupplierView,
  type SupplierRequestView,
} from './supplierRequestView';

export type SupplierRow = {
  draftId: string;
  productName: string;
  kind: 'legacy' | 'passport';
  view: SupplierRequestView;
};

const labelByPassportKey = new Map(PASSPORT_FIELD_DEFINITIONS.map((d) => [d.key, d.label]));

export function supplierRowsFromDrafts(drafts: readonly DraftPassport[]): SupplierRow[] {
  return drafts.flatMap((draft) => {
    const legacyRows: SupplierRow[] = draft.fields
      .filter((f: DraftField) => f.supplierHint || f.provenance === 'pending_supplier')
      .map((field) => ({
        draftId: draft.id,
        productName: draft.productName,
        kind: 'legacy' as const,
        view: legacyFieldToSupplierView(field),
      }));

    const passportRows: SupplierRow[] = Object.entries(draft.passportFields ?? {})
      .filter(([, state]) => state.provenance === 'pending_supplier')
      .map(([key, state]) => ({
        draftId: draft.id,
        productName: draft.productName,
        kind: 'passport' as const,
        view: passportFieldToSupplierView(key, labelByPassportKey.get(key) ?? key, state),
      }));

    return [...legacyRows, ...passportRows];
  });
}

export function loadSupplierRows(): SupplierRow[] {
  const drafts = ensureSupplierRequestMocks(loadAllDrafts());
  return supplierRowsFromDrafts(drafts);
}
