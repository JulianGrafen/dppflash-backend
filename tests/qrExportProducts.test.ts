import { describe, expect, it } from 'vitest';
import {
  buildQrExportProductList,
  qrExportProductsToCsv,
} from '@/app/dashboard/v2/qr-codes/qrExportProducts';
import type { DraftPassport } from '@/app/dashboard/v2/mock/types';

function publishedDraft(overrides: Partial<DraftPassport> = {}): DraftPassport {
  return {
    id: 'draft-1',
    productName: 'Custom Battery',
    status: 'published',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    creationMethod: 'manual',
    visitedSteps: [],
    documents: [],
    fields: [],
    publishedPassId: 'voltstride-720',
    publishedUrl: 'https://example.com/p/voltstride-720',
    ...overrides,
  };
}

describe('buildQrExportProductList', () => {
  it('includes published drafts and catalog SKUs without duplicate pass ids', () => {
    const list = buildQrExportProductList([publishedDraft()]);
    const volt = list.find((p) => p.productId === 'voltstride-720');
    expect(volt?.productName).toBe('Custom Battery');
    expect(volt?.source).toBe('published');
    expect(list.some((p) => p.sku === 'BAT-PRO-27')).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(6);
  });

  it('prefers published draft over catalog row with same pass id', () => {
    const list = buildQrExportProductList([
      publishedDraft({
        productName: 'Override Name',
        publishedPassId: 'BAT-PRO-27',
      }),
    ]);
    const row = list.filter((p) => p.productId === 'BAT-PRO-27');
    expect(row).toHaveLength(1);
    expect(row[0].productName).toBe('Override Name');
  });
});

describe('qrExportProductsToCsv', () => {
  it('escapes quotes in product names', () => {
    const csv = qrExportProductsToCsv([
      {
        rowId: 'x',
        productName: 'Test "Quote"',
        productId: 'BAT-PRO-27',
        sku: 'BAT-PRO-27',
        publicUrl: 'https://example.com/p/BAT-PRO-27',
        source: 'catalog',
      },
    ]);
    expect(csv).toContain('"Test ""Quote"""');
  });
});
