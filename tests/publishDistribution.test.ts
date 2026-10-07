import { describe, expect, it } from 'vitest';
import { createDemoReady100Draft } from '@/app/dashboard/v2/mock/demoReady100Passport';
import {
  buildPublishManifest,
  buildPublishPreflightChecks,
  preflightReady,
} from '@/app/dashboard/v2/lib/publishDistribution';

describe('publishDistribution', () => {
  it('builds manifest with UPI and operator for demo draft', () => {
    const draft = createDemoReady100Draft();
    const manifest = buildPublishManifest(draft);
    expect(manifest.upi).toBeTruthy();
    expect(manifest.economicOperatorId).toMatch(/^DE/);
    expect(manifest.customsTariff).toMatch(/\d{4}/);
  });

  it('preflight passes for 100 % demo', () => {
    const draft = createDemoReady100Draft();
    const checks = buildPublishPreflightChecks(draft, true);
    expect(preflightReady(checks)).toBe(true);
  });
});
