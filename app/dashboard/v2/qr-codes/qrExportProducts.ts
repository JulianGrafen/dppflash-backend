import { MASTER_CATALOG_ROWS } from '@/app/dashboard/v2/onboarding/globalCatalogMock';
import { buildPublicDppPassportUrl } from '@/app/lib/publicDppUrl';
import type { DraftPassport } from '@/app/dashboard/v2/mock/types';

export type QrExportProduct = {
  /** Stable row id (draft id or sku). */
  rowId: string;
  productName: string;
  productId: string;
  sku?: string;
  publicUrl: string;
  completionPercent?: number;
  statusLabel?: string;
  source?: 'published' | 'catalog';
};

function catalogProductId(sku: string): string {
  return sku.trim();
}

export function buildQrExportProductList(drafts: readonly DraftPassport[]): QrExportProduct[] {
  const byProductId = new Map<string, QrExportProduct>();

  for (const draft of drafts) {
    if (draft.status !== 'published') continue;
    const productId = draft.publishedPassId?.trim();
    if (!productId) continue;
    byProductId.set(productId, {
      rowId: draft.id,
      productName: draft.productName,
      productId,
      publicUrl: draft.publishedUrl ?? buildPublicDppPassportUrl(productId),
      source: 'published',
    });
  }

  for (const row of MASTER_CATALOG_ROWS) {
    const productId = catalogProductId(row.sku);
    if (byProductId.has(productId)) continue;
    byProductId.set(productId, {
      rowId: row.sku,
      productName: row.name,
      productId,
      sku: row.sku,
      publicUrl: buildPublicDppPassportUrl(productId),
      completionPercent: row.completion,
      statusLabel: row.status,
      source: 'catalog',
    });
  }

  return [...byProductId.values()].sort((a, b) => a.productName.localeCompare(b.productName, 'de'));
}

export function qrExportProductsToCsv(products: readonly QrExportProduct[]): string {
  const header = ['Produktname', 'SKU', 'Pass-ID', 'DPP-URL', 'Vollständigkeit %', 'Status'];
  const lines = products.map((p) =>
    [
      p.productName,
      p.sku ?? '',
      p.productId,
      p.publicUrl,
      p.completionPercent != null ? String(p.completionPercent) : '',
      p.statusLabel ?? (p.source === 'published' ? 'Veröffentlicht' : ''),
    ]
      .map((cell) => `"${cell.replace(/"/g, '""')}"`)
      .join(','),
  );
  return [header.join(','), ...lines].join('\n');
}
