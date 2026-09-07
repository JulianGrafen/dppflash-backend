import { NextResponse } from 'next/server';

import { supabase } from '@/app/lib/supabase';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId') ?? 'default';

  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase ist nicht konfiguriert (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).' },
      { status: 503 },
    );
  }

  const { data, error } = await supabase
    .from('product_passports')
    .select('id, tenant_id, upi, source, payload, is_draft, created_at, updated_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }

  return NextResponse.json({ tenant_id: tenantId, count: data?.length ?? 0, items: data ?? [] });
}
