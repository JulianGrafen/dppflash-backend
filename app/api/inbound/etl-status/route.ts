import { NextResponse } from 'next/server';

import { fetchEtl, readEtlDiagnostics } from '@/app/lib/etl/fetchEtl';
import { readEtlServiceBaseUrl } from '@/app/lib/etl/etlServiceUrl';

export async function GET() {
  const diagnostics = readEtlDiagnostics();
  try {
    const baseUrl = readEtlServiceBaseUrl();
    const health = await fetchEtl('/api/v1/health');
    return NextResponse.json({
      ok: health.ok,
      etl_base_url: baseUrl,
      health: health.body,
      ...diagnostics,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        ...diagnostics,
        error: error instanceof Error ? error.message : 'ETL-Status nicht abrufbar',
      },
      { status: 503 },
    );
  }
}
