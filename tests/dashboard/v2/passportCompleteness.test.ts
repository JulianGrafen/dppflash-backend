import { describe, expect, it } from 'vitest';
import { computePassportCompleteness } from '@/app/dashboard/v2/mock/passportCompleteness';
import { initializePassportFieldsFromCatalog } from '@/app/dashboard/v2/mock/passportFields';

describe('passportCompleteness', () => {
  it('reports high completeness for voltstride seed', () => {
    const fields = initializePassportFieldsFromCatalog();
    const summary = computePassportCompleteness(fields);
    expect(summary.completenessPercent).toBeGreaterThan(5);
    expect(summary.sections).toHaveLength(10);
  });
});
