import { describe, expect, it } from 'vitest';
import {
  CATALOG_SUMMARY,
  INTEGRATION_DEFINITIONS,
  MASTER_CATALOG_ROWS,
} from '@/app/dashboard/v2/onboarding/globalCatalogMock';

describe('globalCatalogMock', () => {
  it('defines four integrations and five catalog rows', () => {
    expect(INTEGRATION_DEFINITIONS).toHaveLength(4);
    expect(MASTER_CATALOG_ROWS).toHaveLength(5);
  });

  it('summary matches plan totals', () => {
    expect(CATALOG_SUMMARY.totalSkus).toBe(4250);
    expect(CATALOG_SUMMARY.fullyCompliant).toBe(3100);
    expect(CATALOG_SUMMARY.gapsIdentified).toBe(1150);
  });

  it('includes sample SKUs from spec', () => {
    const skus = MASTER_CATALOG_ROWS.map((r) => r.sku);
    expect(skus).toContain('BAT-PRO-27');
    expect(skus).toContain('SCOOT-BAT-V2');
  });
});
