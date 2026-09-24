/** Canonical public origin for passport pages and QR codes (never LAN/local unless unset). */
export const DEFAULT_PUBLIC_DPP_URL = 'https://dppflash-backend.onrender.com';

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/$/, '');
}

/**
 * Base URL encoded in QR codes and share links.
 * Prefers `NEXT_PUBLIC_DPP_URL`, then `NEXT_PUBLIC_APP_URL` (Next build), then current origin in browser.
 */
export function getPublicDppBaseUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_DPP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    return normalizeBaseUrl(configured);
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return DEFAULT_PUBLIC_DPP_URL;
}

export function buildPublicDppPassportPath(productId: string, query = ''): string {
  return `/p/${encodeURIComponent(productId)}${query}`;
}

export function buildPublicDppPassportUrl(productId: string, query = ''): string {
  return `${getPublicDppBaseUrl()}${buildPublicDppPassportPath(productId, query)}`;
}
