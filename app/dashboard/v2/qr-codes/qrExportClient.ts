import { sanitizeFilenameToken } from '@/app/lib/security/safeProductId';
import type { QrExportProduct } from './qrExportProducts';

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(url);
}

export async function downloadQrImage(productId: string, format: 'png' | 'svg'): Promise<void> {
  const response = await fetch('/api/qr-code/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId, format }),
  });
  if (!response.ok) {
    throw new Error('QR-Download fehlgeschlagen');
  }
  const blob = await response.blob();
  const token = sanitizeFilenameToken(productId);
  triggerBrowserDownload(blob, `dpp-${token}-qr.${format}`);
}

export function downloadProductExportJson(product: QrExportProduct): void {
  const payload = {
    exportedAt: new Date().toISOString(),
    productName: product.productName,
    sku: product.sku ?? null,
    passId: product.productId,
    publicUrl: product.publicUrl,
    completionPercent: product.completionPercent ?? null,
    statusLabel: product.statusLabel ?? null,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const token = sanitizeFilenameToken(product.sku ?? product.productId);
  triggerBrowserDownload(blob, `dpp-export-${token}.json`);
}

export function downloadCsvFile(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  triggerBrowserDownload(blob, filename);
}

export async function fetchQrPreviewDataUrl(productId: string): Promise<string> {
  const response = await fetch('/api/qr-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId }),
  });
  if (!response.ok) {
    throw new Error('QR-Vorschau fehlgeschlagen');
  }
  const data = (await response.json()) as { qrCodeDataUrl?: string };
  if (!data.qrCodeDataUrl) {
    throw new Error('Keine QR-Daten');
  }
  return data.qrCodeDataUrl;
}
