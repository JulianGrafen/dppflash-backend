import { NextResponse } from 'next/server';

import { fetchEtl } from '@/app/lib/etl/fetchEtl';

type RouteContext = { params: Promise<{ eventId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { eventId } = await context.params;
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId') ?? 'default';
  try {
    const { status, body } = await fetchEtl(
      `/api/v1/inbound/staging/events/${encodeURIComponent(eventId)}?tenant_id=${encodeURIComponent(tenantId)}`,
    );
    return NextResponse.json(body, { status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Staging-Detail fehlgeschlagen' },
      { status: 503 },
    );
  }
}
