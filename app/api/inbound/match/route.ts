import { NextResponse } from 'next/server';

import { readEtlServiceBaseUrl, readEtlServiceHeaders } from '@/app/lib/etl/etlServiceUrl';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const response = await fetch(`${readEtlServiceBaseUrl()}/api/v1/dpp/match`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...readEtlServiceHeaders(),
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({ error: 'Ungültige ETL-Antwort' }));
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Match fehlgeschlagen' },
      { status: 503 },
    );
  }
}
