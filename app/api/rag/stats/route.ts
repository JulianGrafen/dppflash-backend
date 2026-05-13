import { NextRequest, NextResponse } from 'next/server';
import { assertSafeProductId } from '@/app/lib/security/safeProductId';
import {
  getRagComplianceOrchestrator,
  getRagIndexStatsForTenant,
} from '@/app/infrastructure/rag/ragServerSingleton';

export const runtime = 'nodejs';

/**
 * GET /api/rag/stats?tenantId=...
 * Returns chunk count and distinct source file names in the RAG index (Supabase or in-memory).
 */
export async function GET(request: NextRequest) {
  const tenantParam = request.nextUrl.searchParams.get('tenantId');
  if (!tenantParam) {
    return NextResponse.json({ error: 'tenantId ist erforderlich' }, { status: 400 });
  }

  let tenantId: string;
  try {
    tenantId = assertSafeProductId(tenantParam);
  } catch {
    return NextResponse.json({ error: 'Ungültiger tenantId' }, { status: 400 });
  }

  getRagComplianceOrchestrator();
  const indexStats = await getRagIndexStatsForTenant(tenantId);

  return NextResponse.json({ tenantId, indexStats });
}
