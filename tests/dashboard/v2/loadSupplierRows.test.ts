import { describe, expect, it } from 'vitest';
import { supplierRowsFromDrafts } from '@/app/dashboard/v2/lib/loadSupplierRows';
import type { DraftPassport, PassportFieldValueState } from '@/app/dashboard/v2/mock/types';

describe('supplierRowsFromDrafts', () => {
  it('includes passport fields with pending_supplier provenance', () => {
    const passportFields: Record<string, PassportFieldValueState> = {
      'battery.uniqueId': {
        value: '',
        provenance: 'pending_supplier',
        confidence: 0,
        mandatory: true,
        supplierHint: 'Test Supplier GmbH',
        supplierEmail: 'test@supplier.example',
        supplierSentAt: '2025-01-01T12:00:00.000Z',
      },
    };

    const draft: DraftPassport = {
      id: 'draft-test',
      productName: 'Test Pack',
      status: 'draft',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      creationMethod: 'manual',
      visitedSteps: [],
      documents: [],
      fields: [],
      passportFields,
    };

    const rows = supplierRowsFromDrafts([draft]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe('passport');
    expect(rows[0]?.view.path).toBe('battery.uniqueId');
    expect(rows[0]?.view.provenance).toBe('pending_supplier');
  });
});
