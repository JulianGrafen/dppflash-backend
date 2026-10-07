import { DEMO_READY_100_DRAFT_ID } from '@/app/dashboard/v2/mock/demoReady100Passport';
import { computePassportCompleteness } from '@/app/dashboard/v2/mock/passportCompleteness';
import { ensurePassportFieldsOnDraft } from '@/app/dashboard/v2/mock/passportFields';
import { VOLTSTRIDE_SUPPLIER_DRAFT_ID } from '@/app/dashboard/v2/mock/supplierRequestSeed';
import type { DraftPassport } from '@/app/dashboard/v2/mock/types';

const DEFAULT_PRODUCT_NAME = 'Neuer Produktpass';
const MAX_STUB_COMPLETENESS_PERCENT = 15;

const PROTECTED_DRAFT_IDS = new Set([DEMO_READY_100_DRAFT_ID, VOLTSTRIDE_SUPPLIER_DRAFT_ID]);

/** Leerer Upload-Entwurf ohne Wizard-Fortschritt — nicht in Listen anzeigen. */
export function isDiscardableStubDraft(draft: DraftPassport): boolean {
  if (draft.status === 'published' || draft.status === 'review') {
    return false;
  }
  if (PROTECTED_DRAFT_IDS.has(draft.id)) {
    return false;
  }
  if (draft.productName !== DEFAULT_PRODUCT_NAME) {
    return false;
  }
  const wizardStarted =
    draft.fields.length > 0 ||
    draft.visitedSteps.includes('review-data') ||
    draft.visitedSteps.includes('gaps') ||
    draft.visitedSteps.includes('check') ||
    draft.visitedSteps.includes('publish');
  if (wizardStarted) {
    return false;
  }
  const summary = computePassportCompleteness(ensurePassportFieldsOnDraft(draft));
  return summary.completenessPercent <= MAX_STUB_COMPLETENESS_PERCENT;
}

export function filterVisibleDrafts(drafts: readonly DraftPassport[]): DraftPassport[] {
  return drafts.filter((d) => !isDiscardableStubDraft(d));
}
