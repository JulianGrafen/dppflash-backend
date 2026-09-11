import { NextResponse } from 'next/server';

import { fetchEtl } from '@/app/lib/etl/fetchEtl';

type RouteContext = { params: Promise<{ eventId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { eventId } = await context.params;
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId') ?? 'default';
  try {
    const { status, body } = await fetchEtl(
      `/api/v1/inbound/staging/events/${encodeURIComponent(eventId)}/preview-validate?tenant_id=${encodeURIComponent(tenantId)}`,
      { method: 'POST' },
    );
    return NextResponse.json(body, { status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Preview-Validierung fehlgeschlagen' },
      { status: 503 },
    );
  }
}
