import { computeCompleteness } from '@/app/dashboard/v2/mock/completeness';
import type { DraftPassport, WizardStep } from '@/app/dashboard/v2/mock/types';
import { WIZARD_STEPS } from '@/app/dashboard/v2/mock/types';

export type HubStats = {
  activePasses: number;
  openGaps: number;
  openReviews: number;
  openTasks: number;
  publishedCount: number;
};

export function computeHubStats(drafts: readonly DraftPassport[]): HubStats {
  let openGaps = 0;
  let openReviews = 0;
  let openTasks = 0;
  let publishedCount = 0;

  for (const draft of drafts) {
    if (draft.status === 'published') {
      publishedCount += 1;
      continue;
    }
    const summary = computeCompleteness(draft.fields);
    openGaps += summary.missingCount;
    openReviews += summary.needsReviewCount;
    openTasks += summary.missingCount + summary.needsReviewCount;
  }

  const activePasses = drafts.filter((d) => d.status !== 'published').length;

  return {
    activePasses,
    openGaps,
    openReviews,
    openTasks,
    publishedCount,
  };
}

export function draftResumeHref(draft: DraftPassport): string {
  const wizardHasData =
    draft.fields.length > 0 ||
    draft.status === 'published' ||
    draft.visitedSteps.includes('review-data') ||
    draft.visitedSteps.includes('check') ||
    draft.visitedSteps.includes('publish');

  if (wizardHasData) {
    return `/dashboard/v2/passports/${draft.id}/editor`;
  }
  const lastVisited = draft.visitedSteps.at(-1);
  const step: WizardStep =
    lastVisited && WIZARD_STEPS.includes(lastVisited as WizardStep)
      ? (lastVisited as WizardStep)
      : 'upload';

  return `/dashboard/v2/passports/new/${draft.id}/${step}`;
}

export function formatDraftDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}
