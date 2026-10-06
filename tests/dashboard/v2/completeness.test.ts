import { describe, expect, it } from 'vitest';
import { buildFieldsAfterExtraction } from '@/app/dashboard/v2/mock/batteryWizardFixture';
import { computeCompleteness } from '@/app/dashboard/v2/mock/completeness';

describe('computeCompleteness', () => {
  it('matches battery fixture expectations', () => {
    const fields = buildFieldsAfterExtraction();
    const summary = computeCompleteness(fields);
    expect(summary.missingCount).toBe(3);
    expect(summary.needsReviewCount).toBeGreaterThanOrEqual(2);
    expect(summary.completenessPercent).toBeGreaterThanOrEqual(80);
    expect(summary.completenessPercent).toBeLessThanOrEqual(90);
    expect(summary.criticalOk).toBe(false);
  });
});
