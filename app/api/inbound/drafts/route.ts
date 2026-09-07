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

const DRAFTS_SELECT_FULL =
  'id, tenant_id, upi, source, payload, is_draft, match_status, master_upi, matched_by, validation_status, readiness_score_percent, validation_report, gaps, validated_at, created_at, updated_at';

const DRAFTS_SELECT_LEGACY =
  'id, tenant_id, upi, source, payload, is_draft, match_status, master_upi, matched_by, created_at, updated_at';

async function fetchDraftsFromEtl(tenantId: string) {
  const { ok, status, body } = await fetchEtl(
    `/api/v1/dpp/drafts?tenant_id=${encodeURIComponent(tenantId)}`,
  );
  if (!ok) {
    throw new Error(
      typeof body.detail === 'string'
        ? body.detail
        : `ETL-Liste fehlgeschlagen (HTTP ${status}).`,
    );
  }
  return body;
}

function isMissingValidationColumnError(message: string): boolean {
  const lowered = message.toLowerCase();
  return (
    lowered.includes('validation_status') ||
    lowered.includes('readiness_score_percent') ||
    lowered.includes('validation_report') ||
    (lowered.includes('column') && lowered.includes('does not exist'))
  );
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

  let selectColumns = DRAFTS_SELECT_FULL;
  let result = await supabase
    .from('product_passports')
    .select(selectColumns)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (result.error && isMissingValidationColumnError(result.error.message ?? '')) {
    selectColumns = DRAFTS_SELECT_LEGACY;
    result = await supabase
      .from('product_passports')
      .select(selectColumns)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(200);
  }

  const { data, error } = result;

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

  const items = data ?? [];
  if (items.length > 0) {
    return NextResponse.json({
      tenant_id: tenantId,
      count: items.length,
      items,
      storage: 'supabase',
      hint:
        selectColumns === DRAFTS_SELECT_LEGACY
          ? 'Validation-Migration fehlt — führe supabase/migrations/20260908120000_product_passports_validation.sql aus.'
          : undefined,
    });
  }

  // Upload goes through ETL; if ETL uses in-memory repo, Supabase stays empty.
  try {
    const etlBody = await fetchDraftsFromEtl(tenantId);
    const etlItems = Array.isArray(etlBody.items) ? etlBody.items : [];
    if (etlItems.length > 0) {
      return NextResponse.json({
        tenant_id: tenantId,
        count: etlItems.length,
        items: etlItems,
        storage: 'etl_memory',
        hint:
          'Daten liegen im ETL (In-Memory), nicht in Supabase. ' +
          'Setze auf dppflash-etl: DPP_INBOUND_REPOSITORY=supabase + SUPABASE_SERVICE_ROLE_KEY.',
      });
    }
  } catch {
    // ETL unreachable — return empty Supabase result below.
  }

  return NextResponse.json({
    tenant_id: tenantId,
    count: 0,
    items: [],
    storage: 'supabase',
  });
}
