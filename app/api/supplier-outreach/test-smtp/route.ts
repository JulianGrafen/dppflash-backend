import { NextRequest, NextResponse } from 'next/server';

import process from 'node:process';

function authorize(request: NextRequest): boolean {
  const secret = process.env['SUPPLIER_OUTREACH_SECRET']?.trim();
  if (!secret) {
    return false;
  }
  const header = request.headers.get('authorization')?.trim();
  return header === `Bearer ${secret}`;
}

/**
 * POST /api/supplier-outreach/test-smtp
 * Authorization: Bearer <SUPPLIER_OUTREACH_SECRET>
 * Body: { "to": "recipient@example.com" }
 */
export async function POST(request: NextRequest) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let body: { to?: string };
  try {
    body = (await request.json()) as { to?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const to = body.to?.trim();
  if (!to) {
    return NextResponse.json({ error: 'to is required.' }, { status: 400 });
  }

  try {
    const { runSmtpTest } = await import('@/app/lib/etl/runSmtpTestServer');
    const result = await runSmtpTest(to);
    const status = result.success ? 200 : 502;
    return NextResponse.json(result, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'SMTP test failed.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
