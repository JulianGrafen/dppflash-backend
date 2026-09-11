import { NextResponse } from 'next/server';

import { fetchEtl } from '@/app/lib/etl/fetchEtl';

type RouteContext = { params: Promise<{ eventId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { eventId } = await context.params;
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId') ?? 'default';
  try {
    const payload = await request.json();
    const { status, body } = await fetchEtl(
      `/api/v1/inbound/staging/events/${encodeURIComponent(eventId)}/assign-upi?tenant_id=${encodeURIComponent(tenantId)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );
    return NextResponse.json(body, { status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'UPI-Zuordnung fehlgeschlagen' },
      { status: 503 },
    );
  }
}
