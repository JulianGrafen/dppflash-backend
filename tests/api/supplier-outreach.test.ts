import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const SECRET = 'test-secret-key-for-magic-link';

function buildToken(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', SECRET).update(body).digest('hex');
  return `${body}.${signature}`;
}

const validPayload = {
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

const mockFrom = vi.fn();
const mockSupabase = { from: mockFrom };

vi.mock('@/app/lib/supabase/requireServiceRoleClient', () => ({
  requireSupabaseServiceRoleClient: () => mockSupabase,
}));

describe('supplier-outreach API', () => {
  beforeEach(() => {
    process.env.SUPPLIER_OUTREACH_SECRET = SECRET;
    mockFrom.mockReset();
  });

  afterEach(() => {
    delete process.env.SUPPLIER_OUTREACH_SECRET;
  });

  it('validate upserts a pending session', async () => {
    const selectChain = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const insert = vi.fn().mockResolvedValue({ error: null });

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue(selectChain),
      insert,
    });

    const { GET } = await import('@/app/api/supplier-outreach/validate/route');
    const token = buildToken(validPayload);
    const request = new NextRequest(
      `http://localhost/api/supplier-outreach/validate?token=${encodeURIComponent(token)}`,
    );

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.valid).toBe(true);
    expect(body.status).toBe('pending');
    expect(body.recipient_email).toBe('stefan.meier@covestro.corp');
    expect(insert).toHaveBeenCalledOnce();
  });

  it('submit stores responses and marks session submitted', async () => {
    const selectChain: {
      eq: ReturnType<typeof vi.fn>;
      maybeSingle: ReturnType<typeof vi.fn>;
    } = {
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'sess-1', status: 'pending' }, error: null }),
    };
    selectChain.eq.mockReturnValue(selectChain);
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue(selectChain),
      update,
    });

    const { POST } = await import('@/app/api/supplier-outreach/submit/route');
    const token = buildToken(validPayload);
    const request = new NextRequest('http://localhost/api/supplier-outreach/submit', {
      method: 'POST',
      body: JSON.stringify({
        token,
        responses: {
          'sustainability.environmental_footprint': 'LCA report attached separately.',
        },
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(update).toHaveBeenCalledOnce();
  });

  it('submit rejects already submitted sessions', async () => {
    const selectChain: {
      eq: ReturnType<typeof vi.fn>;
      maybeSingle: ReturnType<typeof vi.fn>;
    } = {
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'sess-1', status: 'submitted' }, error: null }),
    };
    selectChain.eq.mockReturnValue(selectChain);

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue(selectChain),
    });

    const { POST } = await import('@/app/api/supplier-outreach/submit/route');
    const token = buildToken(validPayload);
    const request = new NextRequest('http://localhost/api/supplier-outreach/submit', {
      method: 'POST',
      body: JSON.stringify({ token, responses: { foo: 'bar' } }),
    });

    const response = await POST(request);
    expect(response.status).toBe(409);
  });
});
