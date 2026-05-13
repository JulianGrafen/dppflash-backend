/**
 * Open-redirect mitigation (OWASP A01). Returns a same-origin relative path only.
 */

const MAX_LENGTH = 2048;
const SAFE_SEGMENT = /^[a-zA-Z0-9._-]+$/;

export function safeRelativeRedirectPath(input: string | undefined, fallback: string): string {
  if (!input?.trim()) {
    return fallback;
  }

  const raw = input.trim();

  if (raw.length > MAX_LENGTH) {
    return fallback;
  }

  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) {
    return fallback;
  }

  if (raw.includes('@') || raw.includes('%2f') || raw.includes('%5c')) {
    return fallback;
  }

  const pathOnly = raw.split('?')[0].split('#')[0];
  const segments = pathOnly.split('/').filter(Boolean);

  if (segments.some((s) => s === '.' || s === '..')) {
    return fallback;
  }

  if (!segments.every((s) => SAFE_SEGMENT.test(s))) {
    return fallback;
  }

  return raw;
}
