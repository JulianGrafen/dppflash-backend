import { describe, expect, it } from 'vitest';
import { draftApprovalHref } from '@/app/dashboard/v2/lib/pendingApproval';
import { createDemoReady100Draft } from '@/app/dashboard/v2/mock/demoReady100Passport';

describe('draftApprovalHref', () => {
  it('opens the passport editor for demo-ready drafts instead of the legacy wizard', () => {
    const draft = createDemoReady100Draft();
    expect(draftApprovalHref(draft)).toBe('/dashboard/v2/passports/draft-demo-ready-100/editor');
  });
});
