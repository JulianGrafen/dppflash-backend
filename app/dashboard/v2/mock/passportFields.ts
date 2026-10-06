import {
  PASSPORT_FIELD_DEFINITIONS,
  isMandatoryField,
} from '@/app/domain/battery/passportFieldCatalog';
import { buildVoltstridePassportFieldSeed } from '@/app/domain/battery/voltstrideFieldSeed';
import { VOLTSTRIDE_720_ID } from '@/app/fixtures/voltstride720PublicPassport';
import { attachAuditSourcesToPassportFields } from './passportFieldSource';
import type { DraftField, PassportFieldValueState } from './types';

const REVIEW_THRESHOLD = 0.85;

export function initializePassportFieldsFromCatalog(
  seedOverrides?: Record<string, string>,
): Record<string, PassportFieldValueState> {
  const voltstrideSeed = buildVoltstridePassportFieldSeed();
  const mergedSeed = { ...voltstrideSeed, ...seedOverrides };
  const out: Record<string, PassportFieldValueState> = {};

  for (const def of PASSPORT_FIELD_DEFINITIONS) {
    const seeded = mergedSeed[def.key];
    const hasValue = Boolean(seeded?.trim());
    out[def.key] = {
      value: seeded ?? '',
      provenance: hasValue ? 'ai' : 'empty',
      confidence: hasValue ? 0.92 : 0,
      mandatory: isMandatoryField(def),
    };
  }

  return attachAuditSourcesToPassportFields(out);
}

export function migrateLegacyDraftFields(
  passportFields: Record<string, PassportFieldValueState>,
  legacyFields: readonly DraftField[],
): Record<string, PassportFieldValueState> {
  const next = { ...passportFields };
  for (const legacy of legacyFields) {
    const key = legacy.path.replace(/\//g, '.');
    if (next[key] && legacy.value?.trim()) {
      next[key] = {
        ...next[key],
        value: legacy.value,
        provenance: legacy.provenance === 'confirmed' ? 'confirmed' : 'ai',
        confidence: legacy.confidence,
      };
    }
  }
  return attachAuditSourcesToPassportFields(next);
}

export function ensurePassportFieldsOnDraft(
  draft: {
    passportFields?: Record<string, PassportFieldValueState>;
    fields: DraftField[];
    productName?: string;
  },
): Record<string, PassportFieldValueState> {
  if (draft.passportFields && Object.keys(draft.passportFields).length >= 100) {
    return attachAuditSourcesToPassportFields(
      migrateLegacyDraftFields(draft.passportFields, draft.fields),
    );
  }
  const init = initializePassportFieldsFromCatalog();
  if (draft.productName && draft.productName !== 'Neuer Produktpass') {
    init['battery.passportIdentifier'] = {
      ...init['battery.passportIdentifier'],
      value: draft.productName,
      provenance: 'confirmed',
      confidence: 1,
    };
  }
  return attachAuditSourcesToPassportFields(migrateLegacyDraftFields(init, draft.fields));
}

export function defaultPublishedPassId(): string {
  return VOLTSTRIDE_720_ID;
}

export function passportFieldNeedsReview(state: PassportFieldValueState): boolean {
  if (state.provenance === 'confirmed' || state.provenance === 'empty' || state.provenance === 'missing') {
    return false;
  }
  return state.confidence < REVIEW_THRESHOLD;
}
