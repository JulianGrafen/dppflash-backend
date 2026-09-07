import { NextResponse } from 'next/server';

import { assertFastApiEtlService, fetchEtl, readEtlDiagnostics } from '@/app/lib/etl/fetchEtl';
import { readEtlServiceBaseUrl } from '@/app/lib/etl/etlServiceUrl';

export async function GET() {
  const diagnostics = readEtlDiagnostics();
  try {
    const baseUrl = readEtlServiceBaseUrl();
    const health = await fetchEtl('/api/v1/health');
    assertFastApiEtlService(health.body, baseUrl);

    let diagnosticsBody: Record<string, unknown> | null = null;
    try {
      const diag = await fetchEtl('/diagnostics');
      assertFastApiEtlService(diag.body, baseUrl);
      diagnosticsBody = diag.body;
    } catch {
      // /diagnostics optional on older ETL builds
    }

    return NextResponse.json({
      ok: health.ok && (diagnosticsBody?.service === 'dppflash-etl' || diagnosticsBody === null),
      etl_base_url: baseUrl,
      health: health.body,
      etl_diagnostics: diagnosticsBody,
      routes_include_kmu_upload: Array.isArray(diagnosticsBody?.routes)
        ? (diagnosticsBody.routes as string[]).includes('/api/v1/kmu/upload-erp-export')
        : null,
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
