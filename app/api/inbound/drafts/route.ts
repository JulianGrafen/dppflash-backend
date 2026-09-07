import { NextResponse } from 'next/server';

import { readEtlServiceBaseUrl, readEtlServiceHeaders } from '@/app/lib/etl/etlServiceUrl';
import { supabase } from '@/app/lib/supabase';

function isPlaceholderSupabaseUrl(url: string | undefined): boolean {
  if (!url) return true;
  const lowered = url.toLowerCase();
  return (
    lowered.includes('your-project') ||
    lowered.includes('example.supabase') ||
    lowered.includes('placeholder')
  );
}

async function fetchDraftsFromEtl(tenantId: string) {
  const response = await fetch(
    `${readEtlServiceBaseUrl()}/api/v1/dpp/drafts?tenant_id=${encodeURIComponent(tenantId)}`,
    { headers: readEtlServiceHeaders() },
  );
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof body.detail === 'string'
        ? body.detail
        : `ETL-Liste fehlgeschlagen (HTTP ${response.status}). Läuft uvicorn auf Port 8000?`,
    );
  }
  return body;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId') ?? 'default';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (isPlaceholderSupabaseUrl(supabaseUrl)) {
    try {
      const etlBody = await fetchDraftsFromEtl(tenantId);
      return NextResponse.json({
        ...etlBody,
        storage: 'etl_memory',
        hint:
          'Supabase-URL ist noch ein Platzhalter — Daten kommen vom lokalen ETL (In-Memory). ' +
          'Setze NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY und führe die Migration aus.',
      });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : 'ETL nicht erreichbar. Starte: .venv-langgraph/bin/uvicorn etl.http_service:app --port 8000',
        },
        { status: 503 },
      );
    }
  }

  if (!supabase) {
    try {
      const etlBody = await fetchDraftsFromEtl(tenantId);
      return NextResponse.json({ ...etlBody, storage: 'etl_memory' });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            'Supabase nicht konfiguriert und ETL nicht erreichbar. ' +
            'Setze NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY oder starte den ETL-Server.',
        },
        { status: 503 },
      );
    }
  }

  const { data, error } = await supabase
    .from('product_passports')
    .select('id, tenant_id, upi, source, payload, is_draft, created_at, updated_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    const message = error.message ?? 'Supabase-Abfrage fehlgeschlagen';
    if (message.includes('fetch failed') || message.includes('Failed to fetch')) {
      return NextResponse.json(
        {
          error:
            'Supabase nicht erreichbar (fetch failed). Prüfe NEXT_PUBLIC_SUPABASE_URL in .env.local ' +
            'und ob die Migration product_passports ausgeführt wurde.',
        },
        { status: 502 },
      );
    }
    if (message.includes('product_passports') && message.includes('does not exist')) {
      return NextResponse.json(
        {
          error:
            'Tabelle product_passports fehlt. Führe supabase/migrations/20260907120000_product_passports_inbound.sql aus.',
        },
        { status: 502 },
      );
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json({
    tenant_id: tenantId,
    count: data?.length ?? 0,
    items: data ?? [],
    storage: 'supabase',
  });
}
