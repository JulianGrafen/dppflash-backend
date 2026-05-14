/**
 * Normalizes a raw product label for entity matching (lowercase, no diacritics, alphanumerics + spaces).
 * Example: "Cimsec S1 Flex!" → "cimsec s1 flex"
 */
export function normalizeProductEntityName(raw: string): string {
  const trimmed = raw.normalize('NFKD').replace(/\p{M}/gu, '').trim().toLowerCase();
  const collapsed = trimmed.replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  return collapsed;
}
