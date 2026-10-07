import type { DraftField, DraftPassport } from './types';

export function getDraftFieldValue(fields: readonly DraftField[], path: string): string | null {
  const field = fields.find((f) => f.path === path);
  const value = field?.value?.trim();
  return value || null;
}

function passportFieldString(
  draft: DraftPassport,
  key: string,
): string | null {
  const value = draft.passportFields?.[key]?.value?.trim();
  return value || null;
}

function deriveSkuFromDraft(draft: DraftPassport): string {
  const fromId = draft.id.replace(/^draft-/, '').toUpperCase().replace(/[^A-Z0-9-]/g, '-');
  if (fromId.length >= 4) {
    return fromId;
  }
  return `DPP-${draft.id.slice(-8).toUpperCase()}`;
}

/** Stable demo GTIN-13 from draft id (mock — not for production labeling). */
function deriveDemoGtin13(draft: DraftPassport): string {
  let hash = 0;
  for (const char of draft.id) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  const numeric = String(hash % 1_000_000_000_000).padStart(12, '0');
  return `426${numeric.slice(0, 10)}`;
}

export function resolveDraftSku(draft: DraftPassport): string {
  return (
    getDraftFieldValue(draft.fields, 'productNumber') ??
    passportFieldString(draft, 'battery.passportIdentifier') ??
    draft.publishedPassId?.trim() ??
    deriveSkuFromDraft(draft)
  );
}

export function resolveDraftEan(draft: DraftPassport): string {
  return getDraftFieldValue(draft.fields, 'gtin') ?? deriveDemoGtin13(draft);
}

export function formatSkuEanSubtitle(draft: DraftPassport): string {
  return `SKU: ${resolveDraftSku(draft)} · EAN: ${resolveDraftEan(draft)}`;
}
