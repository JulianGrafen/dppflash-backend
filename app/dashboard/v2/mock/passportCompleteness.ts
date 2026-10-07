import {
  PASSPORT_FIELD_DEFINITIONS,
  PASSPORT_SECTIONS,
  getFieldsForSection,
  type PassportSectionId,
} from '@/app/domain/battery/passportFieldCatalog';
import type { PassportFieldDefinition } from '@/app/domain/battery/passportFieldCatalog';
import type { PassportFieldValueState } from './types';
import { passportFieldHasValue } from './passportFieldLocalization';
import { passportFieldNeedsReview } from './passportFields';

export type SectionCompleteness = {
  sectionId: PassportSectionId;
  filled: number;
  total: number;
  missingMandatory: number;
  needsReview: number;
};

export type PassportCompletenessSummary = {
  completenessPercent: number;
  missingCount: number;
  needsReviewCount: number;
  criticalOk: boolean;
  sections: SectionCompleteness[];
  blockers: readonly { key: string; label: string }[];
};

function isFilled(state: PassportFieldValueState, def: PassportFieldDefinition): boolean {
  return passportFieldHasValue(state, def);
}

export function computePassportCompleteness(
  fields: Record<string, PassportFieldValueState>,
): PassportCompletenessSummary {
  const sections: SectionCompleteness[] = PASSPORT_SECTIONS.map((section) => {
    const defs = getFieldsForSection(section.id);
    let filled = 0;
    let missingMandatory = 0;
    let needsReview = 0;

    for (const def of defs) {
      const state = fields[def.key];
      if (!state) {
        if (def.status === 'Mandatory') {
          missingMandatory += 1;
        }
        continue;
      }
      if (isFilled(state, def)) {
        filled += 1;
      } else if (state.mandatory) {
        missingMandatory += 1;
      }
      if (passportFieldNeedsReview(state)) {
        needsReview += 1;
      }
    }

    return {
      sectionId: section.id,
      filled,
      total: defs.length,
      missingMandatory,
      needsReview,
    };
  });

  const total = Object.keys(fields).length;
  let filledCount = 0;
  let missingMandatory = 0;
  let needsReviewCount = 0;
  const labelByKey = new Map(PASSPORT_FIELD_DEFINITIONS.map((d) => [d.key, d.label]));
  const blockers: { key: string; label: string }[] = [];

  const defByKey = new Map(PASSPORT_FIELD_DEFINITIONS.map((d) => [d.key, d]));

  for (const [key, state] of Object.entries(fields)) {
    const def = defByKey.get(key);
    if (!def) {
      continue;
    }
    if (isFilled(state, def)) {
      filledCount += 1;
    } else if (state.mandatory) {
      missingMandatory += 1;
      blockers.push({ key, label: labelByKey.get(key) ?? key });
    }
    if (passportFieldNeedsReview(state)) {
      needsReviewCount += 1;
    }
  }

  const completenessPercent = total > 0 ? Math.round((filledCount / total) * 100) : 0;

  return {
    completenessPercent,
    missingCount: missingMandatory,
    needsReviewCount,
    criticalOk: missingMandatory === 0,
    sections,
    blockers: blockers.slice(0, 12),
  };
}
