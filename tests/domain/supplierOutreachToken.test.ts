import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  hashOutreachToken,
  verifySupplierOutreachToken,
  SupplierOutreachTokenError,
} from '@/app/domain/supplierOutreach/supplierOutreachToken';

const SECRET = 'test-secret-key-for-magic-link';

function signPayload(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', SECRET).update(body).digest('hex');
  return `${body}.${signature}`;
}

describe('verifySupplierOutreachToken', () => {
  beforeEach(() => {
    process.env.SUPPLIER_OUTREACH_SECRET = SECRET;
  });

  afterEach(() => {
    delete process.env.SUPPLIER_OUTREACH_SECRET;
  });

  it('verifies a valid token', () => {
    const payload = {
      product_identifier: '000000000010048921',
      recipient_email: 'stefan.meier@covestro.corp',
      supplier_name: 'Covestro Deutschland AG',
      gaps: [
        {
          field_path: 'sustainability.environmental_footprint',
          reason: 'Missing LCA.',
          severity: 'major',
        },
      ],
      issued_at: '2026-01-01T00:00:00.000Z',
      expires_at: '2099-01-01T00:00:00.000Z',
    };

    const token = signPayload(payload);
    const verified = verifySupplierOutreachToken(token);

    expect(verified.recipient_email).toBe('stefan.meier@covestro.corp');
    expect(verified.product_identifier).toBe('000000000010048921');
    expect(verified.gaps).toHaveLength(1);
  });

  it('rejects tampered signatures', () => {
    const token = signPayload({
      product_identifier: 'SKU-1',
      recipient_email: 'a@b.c',
      supplier_name: null,
      gaps: [],
      issued_at: '2026-01-01T00:00:00.000Z',
      expires_at: '2099-01-01T00:00:00.000Z',
    });

    const tampered = token.slice(0, -1) + (token.endsWith('0') ? '1' : '0');
    expect(() => verifySupplierOutreachToken(tampered)).toThrow(SupplierOutreachTokenError);
  });

  it('hashes tokens deterministically', () => {
    expect(hashOutreachToken('abc')).toBe(hashOutreachToken('abc'));
    expect(hashOutreachToken('abc')).not.toBe(hashOutreachToken('abcd'));
  });
});
