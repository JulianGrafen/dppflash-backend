import { describe, expect, it } from 'vitest';
import {
  createVoltstrideSupplierSeedDraft,
  ensureSupplierRequestMocks,
} from '@/app/dashboard/v2/mock/supplierRequestSeed';
import { supplierRowsFromDrafts } from '@/app/dashboard/v2/lib/loadSupplierRows';
import { createEmptyDraft } from '@/app/dashboard/v2/mock/batteryWizardFixture';

describe('supplierRequestSeed', () => {
  it('createVoltstrideSupplierSeedDraft includes pending supplier passport and legacy rows', () => {
    const draft = createVoltstrideSupplierSeedDraft();
    const rows = supplierRowsFromDrafts([draft]);
    expect(rows.length).toBeGreaterThanOrEqual(4);
    expect(rows.some((r) => r.kind === 'passport' && r.view.path === 'battery.uniqueId')).toBe(true);
    expect(rows.some((r) => r.kind === 'legacy' && r.view.path === 'materialComposition')).toBe(true);
  });

  it('ensureSupplierRequestMocks seeds when drafts have no supplier rows', () => {
    const empty = createEmptyDraft('draft_only', 'upload');
    const next = ensureSupplierRequestMocks([empty]);
    expect(supplierRowsFromDrafts(next).length).toBeGreaterThanOrEqual(4);
    expect(next.some((d) => d.id === 'voltstride-720')).toBe(true);
  });
});
