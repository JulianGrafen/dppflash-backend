import { NextRequest, NextResponse } from 'next/server';

import {
  hashOutreachToken,
  verifySupplierOutreachToken,
} from '@/app/domain/supplierOutreach/supplierOutreachToken';
import { requireSupabaseServiceRoleClient } from '@/app/lib/supabase/requireServiceRoleClient';

interface SubmitBody {
  token?: string;
  responses?: Record<string, string>;
}

export async function POST(request: NextRequest) {
  let body: SubmitBody;
  try {
    body = (await request.json()) as SubmitBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const token = body.token?.trim();
  if (!token) {
    return NextResponse.json({ error: 'token is required.' }, { status: 400 });
  }

  const responses = body.responses ?? {};
  if (Object.keys(responses).length === 0) {
    return NextResponse.json({ error: 'responses is required.' }, { status: 400 });
  }

  let payload;
  try {
    payload = verifySupplierOutreachToken(token);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid token.';
    return NextResponse.json({ error: message }, { status: 401 });
  }

  try {
    const supabase = requireSupabaseServiceRoleClient();
    const tokenHash = hashOutreachToken(token);
    const submittedAt = new Date().toISOString();

    const { data: existing, error: selectError } = await supabase
      .from('supplier_outreach_sessions')
      .select('id, status')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (selectError) {
      return NextResponse.json({ error: selectError.message }, { status: 500 });
    }

    if (existing?.status === 'submitted') {
      return NextResponse.json({ error: 'Diese Anfrage wurde bereits eingereicht.' }, { status: 409 });
    }

    const row = {
      token_hash: tokenHash,
      product_identifier: payload.product_identifier,
      recipient_email: payload.recipient_email,
      supplier_name: payload.supplier_name,
      gaps: payload.gaps,
      status: 'submitted',
      expires_at: payload.expires_at,
      submitted_payload: responses,
      submitted_at: submittedAt,
    };

    if (existing) {
      const { error: updateError } = await supabase
        .from('supplier_outreach_sessions')
        .update({
          status: 'submitted',
          submitted_payload: responses,
          submitted_at: submittedAt,
        })
        .eq('token_hash', tokenHash);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    } else {
      const { error: insertError } = await supabase.from('supplier_outreach_sessions').insert(row);
      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      submitted_at: submittedAt,
      product_identifier: payload.product_identifier,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Submit failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
