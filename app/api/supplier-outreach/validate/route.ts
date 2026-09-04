import { NextRequest, NextResponse } from 'next/server';

import {
  hashOutreachToken,
  verifySupplierOutreachToken,
  type SupplierOutreachPayload,
} from '@/app/domain/supplierOutreach/supplierOutreachToken';
import { requireSupabaseServiceRoleClient } from '@/app/lib/supabase/requireServiceRoleClient';

function sessionResponse(payload: SupplierOutreachPayload, status: string) {
  return NextResponse.json({
    valid: true,
    status,
    product_identifier: payload.product_identifier,
    supplier_name: payload.supplier_name,
    recipient_email: payload.recipient_email,
    gaps: payload.gaps,
    expires_at: payload.expires_at,
  });
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')?.trim();
  if (!token) {
    return NextResponse.json({ error: 'token is required.' }, { status: 400 });
  }

  let payload: SupplierOutreachPayload;
  try {
    payload = verifySupplierOutreachToken(token);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid token.';
    return NextResponse.json({ valid: false, error: message }, { status: 401 });
  }

  try {
    const supabase = requireSupabaseServiceRoleClient();
    const tokenHash = hashOutreachToken(token);

    const { data: existing, error: selectError } = await supabase
      .from('supplier_outreach_sessions')
      .select('id, status, submitted_payload, submitted_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (selectError) {
      return NextResponse.json({ error: selectError.message }, { status: 500 });
    }

    if (existing) {
      if (existing.status === 'submitted') {
        return NextResponse.json({
          valid: true,
          status: 'submitted',
          product_identifier: payload.product_identifier,
          supplier_name: payload.supplier_name,
          recipient_email: payload.recipient_email,
          gaps: payload.gaps,
          expires_at: payload.expires_at,
          submitted_at: existing.submitted_at,
          submitted_payload: existing.submitted_payload,
        });
      }
      return sessionResponse(payload, existing.status);
    }

    const { error: insertError } = await supabase.from('supplier_outreach_sessions').insert({
      token_hash: tokenHash,
      product_identifier: payload.product_identifier,
      recipient_email: payload.recipient_email,
      supplier_name: payload.supplier_name,
      gaps: payload.gaps,
      status: 'pending',
      expires_at: payload.expires_at,
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return sessionResponse(payload, 'pending');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Validation failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
