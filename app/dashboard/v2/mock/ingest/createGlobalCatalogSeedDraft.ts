import { MASTER_CATALOG_ROWS } from '@/app/dashboard/v2/onboarding/globalCatalogMock';
import { createEmptyDraft } from '../batteryWizardFixture';
import type { DraftField, DraftPassport } from '../types';
import { upsertDraft } from '../storage';

function legacyFields(): DraftField[] {
  const primary = MASTER_CATALOG_ROWS[0];
  return [
    {
      path: 'productNumber',
      label: 'SKU',
      block: 'identification',
      value: primary?.sku ?? 'BAT-PRO-27',
      provenance: 'confirmed',
      confidence: 1,
      critical: true,
    },
  ];
}

export function createGlobalCatalogSeedDraft(tenantId: string): DraftPassport {
  const id = `onboard_catalog_${tenantId.replace(/^tenant_/, '')}`;
  const primaryName = MASTER_CATALOG_ROWS[0]?.name ?? 'Global Catalog Import';
  const draft: DraftPassport = {
    ...createEmptyDraft(id, 'import'),
    productName: primaryName,
    fields: legacyFields(),
    visitedSteps: ['upload', 'review-data'],
  };
  upsertDraft(draft);
  return draft;
}
