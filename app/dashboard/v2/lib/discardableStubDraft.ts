import { DEMO_READY_100_DRAFT_ID } from '@/app/dashboard/v2/mock/demoReady100Passport';
import { VOLTSTRIDE_SUPPLIER_DRAFT_ID } from '@/app/dashboard/v2/mock/supplierRequestSeed';
import type { DraftPassport } from '@/app/dashboard/v2/mock/types';

const DEFAULT_PRODUCT_NAME = 'Neuer Produktpass';

const PROTECTED_DRAFT_IDS = new Set([DEMO_READY_100_DRAFT_ID, VOLTSTRIDE_SUPPLIER_DRAFT_ID]);

/** Leerer Standard-Entwurf — nicht in Listen anzeigen. */
export function isDiscardableStubDraft(draft: DraftPassport): boolean {
  if (draft.status === 'published' || draft.status === 'review') {
    return false;
  }
  if (PROTECTED_DRAFT_IDS.has(draft.id)) {
    return false;
  }
  if (draft.productName.trim() !== DEFAULT_PRODUCT_NAME) {
    return false;
  }
  const hasLegacyFieldData = draft.fields.some((f) => String(f.value ?? '').trim().length > 0);
  if (hasLegacyFieldData) {
    return false;
  }
  return true;
}

export function filterVisibleDrafts(drafts: readonly DraftPassport[]): DraftPassport[] {
  return drafts.filter((d) => !isDiscardableStubDraft(d));
}
