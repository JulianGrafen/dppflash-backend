import type {
  DraftField,
  FieldProvenance,
  PassportFieldProvenance,
  PassportFieldValueState,
} from '@/app/dashboard/v2/mock/types';

export type SupplierRequestView = {
  path: string;
  label: string;
  supplierHint?: string;
  supplierEmail?: string;
  supplierSentAt?: string;
  provenance: FieldProvenance | PassportFieldProvenance;
};

export function legacyFieldToSupplierView(field: DraftField): SupplierRequestView {
  return {
    path: field.path,
    label: field.label,
    supplierHint: field.supplierHint,
    supplierEmail: field.supplierEmail,
    supplierSentAt: field.supplierSentAt,
    provenance: field.provenance,
  };
}

export function passportFieldToSupplierView(
  key: string,
  label: string,
  state: PassportFieldValueState,
): SupplierRequestView {
  return {
    path: key,
    label,
    supplierHint: state.supplierHint,
    supplierEmail: state.supplierEmail,
    supplierSentAt: state.supplierSentAt,
    provenance: state.provenance,
  };
}
