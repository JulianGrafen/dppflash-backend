import { attachAuditSourcesToPassportFields } from '../passportFieldSource';
import type { PassportFieldValueState } from '../types';
import type { IngestFieldPatch, IngestPatchMap, IngestSourceKind } from './types';

function isEmptyState(state: PassportFieldValueState | undefined): boolean {
  if (!state) {
    return true;
  }
  return !state.value?.trim() || state.provenance === 'empty' || state.provenance === 'missing';
}

function shouldApplyPatch(
  current: PassportFieldValueState,
  patch: IngestFieldPatch,
  structured: boolean,
): boolean {
  if (!patch.value.trim()) {
    return false;
  }
  if (isEmptyState(current)) {
    return true;
  }
  if (structured && patch.confidence >= current.confidence) {
    return true;
  }
  return patch.confidence > current.confidence;
}

export function applyIngestToPassportFields(
  fields: Record<string, PassportFieldValueState>,
  patch: IngestPatchMap,
  meta: { source: IngestSourceKind; structured?: boolean },
): Record<string, PassportFieldValueState> {
  const structured = meta.structured ?? meta.source !== 'file';
  const next: Record<string, PassportFieldValueState> = { ...fields };

  for (const [key, fieldPatch] of Object.entries(patch)) {
    const current = next[key];
    if (!current) {
      continue;
    }
    if (!shouldApplyPatch(current, fieldPatch, structured)) {
      continue;
    }
    next[key] = {
      ...current,
      value: fieldPatch.value.trim(),
      confidence: fieldPatch.confidence,
      provenance: fieldPatch.provenance ?? (structured && fieldPatch.confidence >= 0.9 ? 'confirmed' : 'ai'),
      source: fieldPatch.source ?? current.source,
    };
  }

  return attachAuditSourcesToPassportFields(next);
}
