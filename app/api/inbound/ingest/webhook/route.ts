import { NextResponse } from 'next/server';

import { fetchEtl } from '@/app/lib/etl/fetchEtl';

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const body = await request.json();
    const payload = tenantId ? { ...body, tenant_id: body.tenant_id ?? tenantId } : body;

    const { status, body: responseBody } = await fetchEtl(
      `/api/v1/inbound/ingest/webhook${tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : ''}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );
    return NextResponse.json(responseBody, { status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Webhook-Ingest fehlgeschlagen' },
      { status: 503 },
    );
  }
}
