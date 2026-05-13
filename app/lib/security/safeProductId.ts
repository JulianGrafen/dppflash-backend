/**
 * Restrict product IDs used in APIs and response headers (injection / header smuggling).
 * Allows generated prod_* IDs, UUIDs, and short legacy/mock IDs — but no path or header metacharacters.
 */

const PRODUCT_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{2,127}$/;

export function assertSafeProductId(productId: string): string {
  const trimmed = productId.trim();

  if (!PRODUCT_ID_PATTERN.test(trimmed) || trimmed.includes('..')) {
    throw new Error('Invalid productId format.');
  }

  return trimmed;
}

export function sanitizeFilenameToken(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'product';
}
