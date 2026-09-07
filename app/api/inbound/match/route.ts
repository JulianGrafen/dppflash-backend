import { NextResponse } from 'next/server';

import { fetchEtl } from '@/app/lib/etl/fetchEtl';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { status, body: payload } = await fetchEtl('/api/v1/dpp/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return NextResponse.json(payload, { status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Match fehlgeschlagen' },
      { status: 503 },
    );
  }
}
