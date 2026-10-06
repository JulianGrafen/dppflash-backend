import {
  getPassportFieldPrefix,
  type PassportFieldDefinition,
  type PassportSectionDefinition,
} from '@/app/domain/battery/passportFieldCatalog';
import type { PassportFieldValueState } from '@/app/dashboard/v2/mock/types';

export type PassportFieldCategoryGroup = {
  prefix: string;
  fields: PassportFieldDefinition[];
};

export function isFieldPublishBlocker(
  state: PassportFieldValueState | undefined,
): boolean {
  return Boolean(state?.mandatory && !state.value?.trim());
}

function sortFieldsBlockersFirst(
  fields: readonly PassportFieldDefinition[],
  fieldStates: Record<string, PassportFieldValueState>,
): PassportFieldDefinition[] {
  const blockers: PassportFieldDefinition[] = [];
  const rest: PassportFieldDefinition[] = [];

  for (const field of fields) {
    if (isFieldPublishBlocker(fieldStates[field.key])) {
      blockers.push(field);
    } else {
      rest.push(field);
    }
  }

  return [...blockers, ...rest];
}

function categoryHasBlocker(
  group: PassportFieldCategoryGroup,
  fieldStates: Record<string, PassportFieldValueState>,
): boolean {
  return group.fields.some((field) => isFieldPublishBlocker(fieldStates[field.key]));
}

export function groupFieldsByCategoryPrefix(
  fields: readonly PassportFieldDefinition[],
  section: PassportSectionDefinition,
  fieldStates: Record<string, PassportFieldValueState>,
): PassportFieldCategoryGroup[] {
  const byPrefix = new Map<string, PassportFieldDefinition[]>();

  for (const field of fields) {
    const prefix = getPassportFieldPrefix(field.key);
    const list = byPrefix.get(prefix) ?? [];
    list.push(field);
    byPrefix.set(prefix, list);
  }

  const groups: PassportFieldCategoryGroup[] = section.prefixes
    .filter((prefix) => byPrefix.has(prefix))
    .map((prefix) => ({
      prefix,
      fields: sortFieldsBlockersFirst(byPrefix.get(prefix) ?? [], fieldStates),
    }));

  const withBlockers = groups.filter((group) => categoryHasBlocker(group, fieldStates));
  const withoutBlockers = groups.filter((group) => !categoryHasBlocker(group, fieldStates));

  return [...withBlockers, ...withoutBlockers];
}
