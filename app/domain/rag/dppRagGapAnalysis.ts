import { getRagTargetFieldKeysForProductType } from '@/app/domain/rag/ragPassportFieldTargets';
import type { ProductPassport } from '@/app/types/dpp-types';

const PENDING = 'PENDING_EXTERNAL_MATCH';

function isEmptyPassportScalar(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  if (typeof value === 'string') {
    const t = value.trim();
    return t === '' || t === PENDING;
  }
  return false;
}

function isEmptyForRagGap(key: string, value: unknown): boolean {
  if (key === 'materialComposition') {
    if (!Array.isArray(value) || value.length === 0) {
      return true;
    }
    return false;
  }
  if (key === 'chemicalComposition') {
    if (!Array.isArray(value) || value.length === 0) {
      return true;
    }
    return false;
  }
  if (key === 'manufacturer') {
    if (value === undefined || value === null || typeof value !== 'object') {
      return true;
    }
    const m = value as Record<string, unknown>;
    const name = typeof m.name === 'string' ? m.name.trim() : '';
    return name === '';
  }
  return isEmptyPassportScalar(value);
}

/**
 * Schritt 2: Felder, die für RAG-Nachziehen noch leer sind (Schnitt mit erlaubten RAG-Ziel-Keys).
 */
export function detectRagFillableGaps(
  passport: Record<string, unknown>,
  productType: ProductPassport['type'],
): readonly string[] {
  const allowed = new Set(getRagTargetFieldKeysForProductType(productType));
  const gaps: string[] = [];
  for (const key of allowed) {
    if (isEmptyForRagGap(key, passport[key])) {
      gaps.push(key);
    }
  }
  return gaps;
}

/**
 * Schritt 2 (Anker): Nur ESPR-`productName` — ohne Anker kein Targeted RAG.
 */
export function resolvePrimaryProductNameAnchor(passport: Record<string, unknown>): string | null {
  const n = passport.productName;
  if (typeof n !== 'string') {
    return null;
  }
  const t = n.trim();
  return t.length > 0 ? t : null;
}

/** Schritt 2: dynamischer Such-String für Vektor/BM25-Retrieval. */
export function buildGapTargetedSearchQuery(
  missingFieldKeys: readonly string[],
  anchorProductName: string,
): string {
  const fields = missingFieldKeys.length > 0 ? missingFieldKeys.join(', ') : 'ESPR Kennfelder';
  return `${fields} für das Produkt: ${anchorProductName}`;
}
