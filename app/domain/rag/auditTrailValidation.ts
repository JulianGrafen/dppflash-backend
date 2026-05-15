import type { AuditTrail, AuditedValue } from '@/app/domain/rag/auditTrailSchema';
import { isValidGtinDigits } from '@/app/domain/rag/gtinProof';

const EWC_PATTERN = /^\d{2}\s?\d{2}\s?\d{2}\*?$/;

function validateEwc(value: string): boolean {
  const compact = value.replace(/\s+/g, '');
  return EWC_PATTERN.test(compact);
}

function validateAuditedGtin(entry: AuditedValue): readonly string[] {
  if (entry.value === null) {
    return [];
  }

  if (typeof entry.value !== 'string') {
    return [];
  }

  if (!isValidGtinDigits(entry.value)) {
    return [`gtin: Invalid GTIN checksum or length for value "${entry.value}".`];
  }

  return [];
}

function validateAuditedEwc(entry: AuditedValue): readonly string[] {
  if (entry.value === null) {
    return [];
  }

  if (typeof entry.value !== 'string') {
    return [];
  }

  if (!validateEwc(entry.value)) {
    return [`ewcCode: Value "${entry.value}" is not a plausible EWC/EAK pattern.`];
  }

  return [];
}

/** True if this audited value passes the same crypto/format rules used for merge eligibility. */
export function auditedValuePassesCryptoMerge(fieldKey: string, entry: AuditedValue): boolean {
  if (entry.value === null) {
    return true;
  }

  if (fieldKey === 'gtin' || fieldKey === 'ean') {
    return validateAuditedGtin(entry).length === 0;
  }

  if (
    fieldKey === 'ewcCode'
    || fieldKey === 'eakCode'
    || fieldKey === 'abfallSchluessel'
    || fieldKey === 'wasteCode'
  ) {
    return validateAuditedEwc(entry).length === 0;
  }

  return true;
}

/**
 * Drops audited entries that fail GTIN/EWC checks so remaining values can still be merged into the passport.
 * The original trail (e.g. for UI / rawModelJson) stays unchanged; use this only as input to {@link mergeRagAuditIntoPassport}.
 */
export function stripCryptoInvalidAuditedValues(trail: AuditTrail): AuditTrail {
  const next: AuditTrail = {};

  if (trail.gtin && auditedValuePassesCryptoMerge('gtin', trail.gtin)) {
    next.gtin = trail.gtin;
  }

  if (trail.ewcCode && auditedValuePassesCryptoMerge('ewcCode', trail.ewcCode)) {
    next.ewcCode = trail.ewcCode;
  }

  if (trail.fields) {
    const fields: Record<string, AuditedValue> = {};
    for (const [key, entry] of Object.entries(trail.fields)) {
      if (auditedValuePassesCryptoMerge(key, entry)) {
        fields[key] = entry;
      }
    }
    if (Object.keys(fields).length > 0) {
      next.fields = fields;
    }
  }

  return next;
}

/**
 * Deterministic checks beyond Zod (checksums / regex). LLM output must still pass this.
 */
export function validateAuditTrailCryptographically(trail: AuditTrail): {
  readonly ok: boolean;
  readonly errors: readonly string[];
} {
  const errors: string[] = [];

  if (trail.gtin) {
    errors.push(...validateAuditedGtin(trail.gtin));
  }

  if (trail.ewcCode) {
    errors.push(...validateAuditedEwc(trail.ewcCode));
  }

  if (trail.fields) {
    for (const [key, entry] of Object.entries(trail.fields)) {
      if (key === 'gtin' || key === 'ean') {
        errors.push(...validateAuditedGtin(entry).map((m) => m.replace(/^gtin:/, `${key}:`)));
      }
      if (key === 'ewcCode' || key === 'eakCode' || key === 'abfallSchluessel' || key === 'wasteCode') {
        errors.push(...validateAuditedEwc(entry).map((m) => m.replace(/^ewcCode:/, `${key}:`)));
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
