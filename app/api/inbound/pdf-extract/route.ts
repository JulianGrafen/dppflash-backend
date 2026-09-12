import { NextResponse } from 'next/server';

import { fetchEtl } from '@/app/lib/etl/fetchEtl';

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

    const headers: Record<string, string> = {};
    const openaiApiKey = process.env.OPENAI_API_KEY?.trim();
    if (openaiApiKey) {
      headers['X-DPP-OpenAI-Api-Key'] = openaiApiKey;
    }

    const { status, body } = await fetchEtl('/api/v1/extract/pdf', {
      method: 'POST',
      body: outbound,
      headers,
    });
    return NextResponse.json(body, { status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'PDF-Extraktion fehlgeschlagen' },
      { status: 503 },
    );
  }
}
