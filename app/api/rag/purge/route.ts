import { NextRequest, NextResponse } from 'next/server';
import { assertSafeProductId } from '@/app/lib/security/safeProductId';
import { purgeTenantRagAssets } from '@/app/infrastructure/rag/ragServerSingleton';

export const runtime = 'nodejs';

/**
 * POST /api/rag/purge
 *
 * JSON body:
 * - tenantId (required)
 * - deleteRagChunks (optional, default true) — `rag_chunks` / In-Memory-Index für den Mandanten
 * - deletePdfUploadObjects (optional, default false) — `pdf-uploads/tenants/{tenantId}/…`
 * - pdfUploadsCreatedBefore (optional ISO string) — nur ältere Storage-Objekte
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON-Body erforderlich' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Ungültiger Body' }, { status: 400 });
  }

  const rec = body as Record<string, unknown>;
  const tenantRaw = typeof rec.tenantId === 'string' ? rec.tenantId : '';

  let tenantId: string;
  try {
    tenantId = assertSafeProductId(tenantRaw);
  } catch {
    return NextResponse.json({ error: 'Ungültiger tenantId' }, { status: 400 });
  }

  const deleteRagChunks = rec.deleteRagChunks === undefined ? true : Boolean(rec.deleteRagChunks);
  const deletePdfUploadObjects = Boolean(rec.deletePdfUploadObjects);

  let pdfUploadsCreatedBefore: Date | undefined;
  if (typeof rec.pdfUploadsCreatedBefore === 'string' && rec.pdfUploadsCreatedBefore.trim()) {
    const d = new Date(rec.pdfUploadsCreatedBefore.trim());
    if (!Number.isFinite(d.getTime())) {
      return NextResponse.json({ error: 'pdfUploadsCreatedBefore ist kein gültiges Datum' }, { status: 400 });
    }
    pdfUploadsCreatedBefore = d;
  }

  try {
    const result = await purgeTenantRagAssets({
      tenantId,
      deleteRagChunks,
      deletePdfUploadObjects,
      pdfUploadsCreatedBefore,
    });

    return NextResponse.json({
      tenantId,
      deleteRagChunks,
      deletePdfUploadObjects,
      pdfUploadsCreatedBefore: pdfUploadsCreatedBefore?.toISOString() ?? null,
      ...result,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
