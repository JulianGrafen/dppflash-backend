import { describe, expect, it } from 'vitest';
import {
  draftApprovalHref,
  isDraftPendingApproval,
  listDraftsPendingApproval,
} from '@/app/dashboard/v2/lib/pendingApproval';
import type { DraftPassport } from '@/app/dashboard/v2/mock/types';
import { initializePassportFieldsFromCatalog } from '@/app/dashboard/v2/mock/passportFields';

function baseDraft(overrides: Partial<DraftPassport> = {}): DraftPassport {
  return {
    id: 'd-1',
    productName: 'Test Pass',
    status: 'draft',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    creationMethod: 'manual',
    visitedSteps: ['upload'],
    documents: [],
    fields: [],
    passportFields: initializePassportFieldsFromCatalog(),
    ...overrides,
  };
}

describe('isDraftPendingApproval', () => {
  it('includes review status', () => {
    expect(isDraftPendingApproval(baseDraft({ status: 'review' }))).toBe(true);
  });

  it('excludes published', () => {
    expect(isDraftPendingApproval(baseDraft({ status: 'published' }))).toBe(false);
  });
});

describe('listDraftsPendingApproval', () => {
  it('sorts by updatedAt descending', () => {
    const list = listDraftsPendingApproval([
      baseDraft({ id: 'a', status: 'review', updatedAt: '2026-01-01T00:00:00.000Z' }),
      baseDraft({ id: 'b', status: 'review', updatedAt: '2026-01-03T00:00:00.000Z' }),
    ]);
    expect(list.map((d) => d.id)).toEqual(['b', 'a']);
  });
});

describe('draftApprovalHref', () => {
  it('links to publish when publish step was visited', () => {
    expect(
      draftApprovalHref(baseDraft({ visitedSteps: ['upload', 'publish'] })),
    ).toBe('/dashboard/v2/passports/new/d-1/publish');
  });
});
