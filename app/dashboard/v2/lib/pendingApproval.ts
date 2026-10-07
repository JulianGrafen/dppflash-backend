import { draftUsesPassportEditor, passportEditorHref } from '@/app/dashboard/v2/lib/editorDraftHref';
import { computePassportCompleteness } from '@/app/dashboard/v2/mock/passportCompleteness';
import { ensurePassportFieldsOnDraft } from '@/app/dashboard/v2/mock/passportFields';
import type { DraftPassport } from '@/app/dashboard/v2/mock/types';
import { draftResumeHref } from './hubStats';

/** Pässe, die intern freigegeben werden müssen, bevor sie veröffentlicht werden können. */
export function isDraftPendingApproval(draft: DraftPassport): boolean {
  if (draft.status === 'published') {
    return false;
  }
  if (draft.status === 'review') {
    return true;
  }
  const summary = computePassportCompleteness(ensurePassportFieldsOnDraft(draft));
  const reachedReleaseGate =
    draft.visitedSteps.includes('check') || draft.visitedSteps.includes('publish');
  return reachedReleaseGate && summary.criticalOk;
}

export function listDraftsPendingApproval(drafts: readonly DraftPassport[]): DraftPassport[] {
  return drafts
    .filter(isDraftPendingApproval)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function draftApprovalHref(draft: DraftPassport): string {
  if (draftUsesPassportEditor(draft)) {
    return passportEditorHref(draft.id);
  }
  if (draft.visitedSteps.includes('publish')) {
    return `/dashboard/v2/passports/new/${draft.id}/publish`;
  }
  if (draft.visitedSteps.includes('check')) {
    return `/dashboard/v2/passports/new/${draft.id}/check`;
  }
  return draftResumeHref(draft);
}
