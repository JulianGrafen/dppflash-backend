import type { DraftField, DraftPassport } from './types';

const PLACEHOLDER = '—';

export function getDraftFieldValue(fields: readonly DraftField[], path: string): string | null {
  const field = fields.find((f) => f.path === path);
  const value = field?.value?.trim();
  return value || null;
}

function displayIdentifier(value: string | null): string {
  return value ?? PLACEHOLDER;
}

export function formatSkuEanSubtitle(draft: DraftPassport): string {
  const sku = getDraftFieldValue(draft.fields, 'productNumber');
  const ean = getDraftFieldValue(draft.fields, 'gtin');
  return `SKU: ${displayIdentifier(sku)} · EAN: ${displayIdentifier(ean)}`;
}
