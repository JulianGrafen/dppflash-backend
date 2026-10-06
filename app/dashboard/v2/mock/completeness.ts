import type { CompletenessSummary, DraftField } from './types';

const REVIEW_CONFIDENCE_THRESHOLD = 0.85;

export function fieldNeedsReview(field: DraftField): boolean {
  if (field.provenance === 'missing' || field.provenance === 'pending_supplier') {
    return false;
  }
  if (field.provenance === 'confirmed') {
    return false;
  }
  return field.confidence < REVIEW_CONFIDENCE_THRESHOLD;
}

export function computeCompleteness(fields: readonly DraftField[]): CompletenessSummary {
  const relevant = fields.filter((f) => f.provenance !== 'pending_supplier');
  const total = relevant.length;
  if (total === 0) {
    return { completenessPercent: 0, missingCount: 0, needsReviewCount: 0, criticalOk: false };
  }

  let filled = 0;
  let missingCount = 0;
  let needsReviewCount = 0;
  let criticalMissing = 0;

  for (const field of relevant) {
    if (field.provenance === 'missing' || !field.value?.trim()) {
      missingCount += 1;
      if (field.critical) {
        criticalMissing += 1;
      }
      continue;
    }
    filled += 1;
    if (fieldNeedsReview(field)) {
      needsReviewCount += 1;
    }
  }

  const completenessPercent = Math.round((filled / total) * 100);
  const criticalFields = relevant.filter((f) => f.critical);
  const criticalOk =
    criticalMissing === 0 &&
    criticalFields.every((f) => f.value?.trim() && f.provenance !== 'missing');

  return {
    completenessPercent,
    missingCount,
    needsReviewCount,
    criticalOk,
  };
}

export function canPublish(summary: CompletenessSummary): boolean {
  return summary.criticalOk && summary.missingCount === 0;
}
