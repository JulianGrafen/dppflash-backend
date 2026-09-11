import { NextResponse } from 'next/server';

import { fetchEtl } from '@/app/lib/etl/fetchEtl';
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId') ?? 'default';
  const etlPath = `/api/v1/inbound/stammdaten?tenant_id=${encodeURIComponent(tenantId)}`;

  if (isPlaceholderSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) || !supabase) {
    try {
      const { ok, status, body } = await fetchEtl(etlPath);
      return NextResponse.json(body, { status: ok ? 200 : status });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Stammdaten laden fehlgeschlagen' },
        { status: 503 },
      );
    }
  }

  const { data, error } = await supabase
    .from('tenant_inbound_stammdaten')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) {
    try {
      const { ok, status, body } = await fetchEtl(etlPath);
      return NextResponse.json(body, { status: ok ? 200 : status });
    } catch (etlError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
  }

  return NextResponse.json({
    tenant_id: tenantId,
    stammdaten: data,
    storage: 'supabase',
  });
}

export async function PUT(request: Request) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId') ?? 'default';
  const payload = await request.json();
  const etlPath = `/api/v1/inbound/stammdaten?tenant_id=${encodeURIComponent(tenantId)}`;

  if (isPlaceholderSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) || !supabase) {
    try {
      const { ok, status, body } = await fetchEtl(etlPath, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return NextResponse.json(body, { status: ok ? 200 : status });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Stammdaten speichern fehlgeschlagen' },
        { status: 503 },
      );
    }
  }

  const row = {
    tenant_id: tenantId,
    hersteller: payload.hersteller ?? null,
    herstelleradresse: payload.herstelleradresse ?? null,
    kontakt: payload.kontakt ?? null,
    eori: payload.eori ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('tenant_inbound_stammdaten')
    .upsert(row, { onConflict: 'tenant_id' })
    .select()
    .single();

  if (error) {
    try {
      const { ok, status, body } = await fetchEtl(etlPath, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return NextResponse.json(body, { status: ok ? 200 : status });
    } catch (etlError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
  }

  return NextResponse.json({ tenant_id: tenantId, stammdaten: data, storage: 'supabase' });
}
