import { describe, expect, it } from 'vitest';
import { buildFieldsAfterExtraction, createEmptyDraft } from '@/app/dashboard/v2/mock/batteryWizardFixture';
import {
  formatSkuEanSubtitle,
  getDraftFieldValue,
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

  it('uses em dash when identifiers are missing', () => {
    const draft = createEmptyDraft('draft_empty', 'upload');
    expect(formatSkuEanSubtitle(draft)).toBe('SKU: — · EAN: —');
  });
});
