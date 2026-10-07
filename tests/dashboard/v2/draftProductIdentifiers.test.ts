import { describe, expect, it } from 'vitest';
import { createDemoReady100Draft } from '@/app/dashboard/v2/mock/demoReady100Passport';
import { buildFieldsAfterExtraction, createEmptyDraft } from '@/app/dashboard/v2/mock/batteryWizardFixture';
import {
  formatSkuEanSubtitle,
  getDraftFieldValue,
  resolveDraftEan,
  resolveDraftSku,
} from '@/app/dashboard/v2/mock/draftProductIdentifiers';

describe('draftProductIdentifiers', () => {
  it('formats SKU and EAN from wizard extraction fields', () => {
    const fields = buildFieldsAfterExtraction();
    const draft = { ...createEmptyDraft('draft_test', 'upload'), fields };
    expect(formatSkuEanSubtitle(draft)).toBe(
      'SKU: TV-NMC-52-001 · EAN: 4260123456789',
    );
    expect(getDraftFieldValue(fields, 'productNumber')).toBe('TV-NMC-52-001');
    expect(getDraftFieldValue(fields, 'gtin')).toBe('4260123456789');
  });

  it('always resolves SKU and EAN when wizard fields are empty', () => {
    const draft = createEmptyDraft('draft_empty', 'upload');
    expect(resolveDraftSku(draft)).toBe('voltstride-720');
    expect(resolveDraftEan(draft)).toMatch(/^426\d{10}$/);
    expect(formatSkuEanSubtitle(draft)).not.toContain('—');
  });

  it('uses explicit identifiers on the 100 % demo draft', () => {
    const draft = createDemoReady100Draft();
    expect(formatSkuEanSubtitle(draft)).toBe('SKU: DEMO-READY-100 · EAN: 4260123456100');
  });
});
