import { describe, expect, it } from 'vitest';
import { createEmptyDraft } from '@/app/dashboard/v2/mock/batteryWizardFixture';
import {
  filterVisibleDrafts,
  isDiscardableStubDraft,
} from '@/app/dashboard/v2/lib/discardableStubDraft';

describe('discardableStubDraft', () => {
  it('flags default empty upload draft', () => {
    const draft = createEmptyDraft('draft_stub_test', 'upload');
    expect(isDiscardableStubDraft(draft)).toBe(true);
    expect(filterVisibleDrafts([draft])).toHaveLength(0);
  });

  it('keeps draft after wizard review step when legacy fields have data', () => {
    const draft = {
      ...createEmptyDraft('draft_started', 'upload'),
      visitedSteps: ['upload', 'review-data'],
      fields: [
        {
          path: 'x',
          label: 'X',
          block: 'identification',
          value: 'a',
          provenance: 'ai',
          confidence: 1,
          critical: false,
        },
      ],
    };
    expect(isDiscardableStubDraft(draft)).toBe(false);
  });

  it('discards default-name draft without legacy wizard field data', () => {
    const draft = {
      ...createEmptyDraft('draft_abandoned', 'upload'),
      visitedSteps: ['upload', 'review-data'],
    };
    expect(isDiscardableStubDraft(draft)).toBe(true);
  });
});
