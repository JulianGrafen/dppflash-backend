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
  const status = searchParams.get('status');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const etlPath =
    `/api/v1/inbound/staging/events?tenant_id=${encodeURIComponent(tenantId)}` +
    (status ? `&status=${encodeURIComponent(status)}` : '');

  if (isPlaceholderSupabaseUrl(supabaseUrl) || !supabase) {
    try {
      const { ok, status: httpStatus, body } = await fetchEtl(etlPath);
      if (!ok) {
        return NextResponse.json(body, { status: httpStatus });
      }
      return NextResponse.json({ ...body, storage: 'etl_memory' });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Staging-Liste fehlgeschlagen' },
        { status: 503 },
      );
    }
  }

  let query = supabase
    .from('staging_events')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (status) {
    query = query.eq('status', status);
  }
  const { data, error } = await query;
  if (error) {
    try {
      const { ok, status: httpStatus, body } = await fetchEtl(etlPath);
      if (!ok) {
        return NextResponse.json(body, { status: httpStatus });
      }
      return NextResponse.json({ ...body, storage: 'etl_memory', hint: error.message });
    } catch (etlError) {
      return NextResponse.json(
        { error: etlError instanceof Error ? etlError.message : error.message },
        { status: 503 },
      );
    }
  }

  return NextResponse.json({
    tenant_id: tenantId,
    count: data?.length ?? 0,
    items: data ?? [],
    storage: 'supabase',
  });
}
