import type { PassportFieldDefinition, PassportSectionDefinition } from '@/app/domain/battery/passportFieldCatalog';
import { passportFieldHasValue } from '@/app/dashboard/v2/mock/passportFieldLocalization';
import type { PassportFieldValueState } from '@/app/dashboard/v2/mock/types';
import { categoryPrefixForField } from './telemetryFields';

export type PassportFieldCategoryGroup = {
  prefix: string;
  fields: PassportFieldDefinition[];
};

export function isFieldPublishBlocker(
  state: PassportFieldValueState | undefined,
  def: PassportFieldDefinition,
): boolean {
  return Boolean(state?.mandatory && state && !passportFieldHasValue(state, def));
}

function sortFieldsBlockersFirst(
  fields: readonly PassportFieldDefinition[],
  fieldStates: Record<string, PassportFieldValueState>,
): PassportFieldDefinition[] {
  const blockers: PassportFieldDefinition[] = [];
  const rest: PassportFieldDefinition[] = [];

  for (const field of fields) {
    if (isFieldPublishBlocker(fieldStates[field.key], field)) {
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
  return group.fields.some((field) => isFieldPublishBlocker(fieldStates[field.key], field));
}

export function groupFieldsByCategoryPrefix(
  fields: readonly PassportFieldDefinition[],
  section: PassportSectionDefinition,
  fieldStates: Record<string, PassportFieldValueState>,
): PassportFieldCategoryGroup[] {
  const byPrefix = new Map<string, PassportFieldDefinition[]>();

  for (const field of fields) {
    const prefix = categoryPrefixForField(field);
    const list = byPrefix.get(prefix) ?? [];
    list.push(field);
    byPrefix.set(prefix, list);
  }

  const orderedPrefixes: string[] = [];
  for (const prefix of section.prefixes) {
    if (!orderedPrefixes.includes(prefix)) {
      orderedPrefixes.push(prefix);
    }
    if (prefix === 'durability' && byPrefix.has('telemetry')) {
      orderedPrefixes.push('telemetry');
    }
  }
  if (byPrefix.has('telemetry') && !orderedPrefixes.includes('telemetry')) {
    orderedPrefixes.push('telemetry');
  }

  const groups: PassportFieldCategoryGroup[] = orderedPrefixes
    .filter((prefix) => byPrefix.has(prefix))
    .map((prefix) => ({
      prefix,
      fields: sortFieldsBlockersFirst(byPrefix.get(prefix) ?? [], fieldStates),
    }));

  const withBlockers = groups.filter((group) => categoryHasBlocker(group, fieldStates));
  const withoutBlockers = groups.filter((group) => !categoryHasBlocker(group, fieldStates));

  return [...withBlockers, ...withoutBlockers];
}
