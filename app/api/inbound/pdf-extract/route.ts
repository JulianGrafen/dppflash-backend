import { NextResponse } from 'next/server';

import { readEtlServiceBaseUrl, readEtlServiceHeaders } from '@/app/lib/etl/etlServiceUrl';

export async function POST(request: Request) {
  try {
    const incoming = await request.formData();
    const file = incoming.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file ist erforderlich (multipart/form-data).' }, { status: 400 });
    }

    const tenantId = incoming.get('tenantId')?.toString() ?? 'default';
    const outbound = new FormData();
    outbound.append('file', file, file.name);
    outbound.append('tenant_id', tenantId);
    outbound.append('persist', 'true');

    const response = await fetch(`${readEtlServiceBaseUrl()}/api/v1/extract/pdf`, {
      method: 'POST',
      headers: readEtlServiceHeaders(),
      body: outbound,
    }).catch((error: unknown) => {
      throw new Error(
        `ETL nicht erreichbar unter ${readEtlServiceBaseUrl()}. ` +
          'Starte: .venv-langgraph/bin/uvicorn etl.http_service:app --port 8000',
        { cause: error },
      );
    });

    const body = await response.json().catch(() => ({ error: 'Ungültige ETL-Antwort' }));
    return NextResponse.json(body, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'PDF-Extraktion fehlgeschlagen' },
      { status: 503 },
    );
  }
}
