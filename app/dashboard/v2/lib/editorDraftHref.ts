import type { DraftPassport } from '@/app/dashboard/v2/mock/types';

export function draftUsesPassportEditor(draft: DraftPassport): boolean {
  const fieldCount = draft.passportFields ? Object.keys(draft.passportFields).length : 0;
  return fieldCount > 0;
}

export function passportEditorHref(draftId: string): string {
  return `/dashboard/v2/passports/${draftId}/editor`;
}
