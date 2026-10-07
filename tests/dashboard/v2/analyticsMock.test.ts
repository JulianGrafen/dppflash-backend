import { describe, expect, it } from 'vitest';
import {
  ANALYTICS_KPIS,
  COMPLETENESS_WEEKLY,
  SUPPLIER_RESPONSE_ROWS,
} from '@/app/dashboard/v2/analytics/analyticsMock';

describe('analyticsMock', () => {
  it('exposes four KPIs and weekly completeness series', () => {
    expect(ANALYTICS_KPIS).toHaveLength(4);
    expect(COMPLETENESS_WEEKLY.length).toBeGreaterThanOrEqual(6);
    expect(SUPPLIER_RESPONSE_ROWS[0]?.domain).toContain('.');
  });
});
