import type { DppFieldTier, DppPassField, DppPassSectionId, DppRole } from '@/app/_data/sample-dpp.data';

export function visibleForRole(tier: DppFieldTier | undefined, role: DppRole) {
  if (!tier) return true;
  if (tier === 'public') return true;
  if (tier === 'recycler') return role === 'recycler' || role === 'auditor';
  return role === 'auditor';
}

export function sectionHasVisibleFields(
  sectionId: DppPassSectionId,
  fields: DppPassField[],
  role: DppRole,
): boolean {
  return fields.some(
    (f) => f.sectionId === sectionId && visibleForRole(f.tier, role),
  );
}
