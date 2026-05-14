import { NextRequest, NextResponse } from 'next/server';
import { assertSafeProductId } from '@/app/lib/security/safeProductId';
import { listRagIndexChunksForTenant } from '@/app/infrastructure/rag/ragServerSingleton';

export const runtime = 'nodejs';

const MAX_LIMIT = 100;
const MAX_CONTAINS = 160;

/**
 * GET /api/rag/chunks?tenantId=...&limit=&offset=&fileName=&contains=
 *
 * Paginated chunk previews (no embeddings) for the RAG dashboard visualizer.
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

  const limitRaw = request.nextUrl.searchParams.get('limit');
  const offsetRaw = request.nextUrl.searchParams.get('offset');
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number.parseInt(limitRaw ?? '30', 10) || 30));
  const offset = Math.max(0, Number.parseInt(offsetRaw ?? '0', 10) || 0);

  const fileNameParam = request.nextUrl.searchParams.get('fileName')?.trim();
  const fileName = fileNameParam && fileNameParam.length > 0 ? fileNameParam.slice(0, 255) : undefined;

  let textContains =
    request.nextUrl.searchParams.get('contains')?.trim()
    ?? request.nextUrl.searchParams.get('q')?.trim();
  if (textContains && textContains.length > MAX_CONTAINS) {
    textContains = textContains.slice(0, MAX_CONTAINS);
  }

  try {
    const { chunks, total } = await listRagIndexChunksForTenant(tenantId, {
      limit,
      offset,
      fileName,
      textContains: textContains || undefined,
    });

    return NextResponse.json({
      tenantId,
      limit,
      offset,
      fileName: fileName ?? null,
      contains: textContains || null,
      total,
      chunks,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
