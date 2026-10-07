import { describe, expect, it } from 'vitest';
import { PASSPORT_FIELD_COUNT } from '@/app/domain/battery/passportFieldCatalog';
import { computePassportCompleteness } from '@/app/dashboard/v2/mock/passportCompleteness';
import {
  buildDemoReady100PassportFields,
  createDemoReady100Draft,
} from '@/app/dashboard/v2/mock/demoReady100Passport';
import { DEMO_READY_100_ID } from '@/app/fixtures/demoReady100PublicPassport';
import { getSampleDppPass } from '@/app/_data/sample-dpp.data';

describe('demoReady100Passport', () => {
  it('fills all catalog fields with 100 % readiness', () => {
    const fields = buildDemoReady100PassportFields();
    expect(Object.keys(fields).length).toBe(PASSPORT_FIELD_COUNT);
    const summary = computePassportCompleteness(fields);
    expect(summary.completenessPercent).toBe(100);
    expect(summary.missingCount).toBe(0);
    expect(summary.needsReviewCount).toBe(0);
    expect(summary.criticalOk).toBe(true);
  });

  it('creates a review draft pointing at the demo pass id', () => {
    const draft = createDemoReady100Draft();
    expect(draft.status).toBe('review');
    expect(draft.publishedPassId).toBe(DEMO_READY_100_ID);
    expect(draft.visitedSteps).toContain('check');
  });

  it('resolves public sample layout for demo-ready-100', () => {
    const pass = getSampleDppPass('demo-ready-100');
    expect(pass?.slug).toBe('demo-ready-100');
    expect(pass?.verifiedFieldsCount).toBe(110);
  });
});
