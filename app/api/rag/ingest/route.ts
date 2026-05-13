import { basename } from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { assertSafeProductId } from '@/app/lib/security/safeProductId';
import {
  getRagComplianceOrchestrator,
  getRagIndexStatsForTenant,
} from '@/app/infrastructure/rag/ragServerSingleton';

const MAX_FILES = 20;
const MAX_BYTES = 10 * 1024 * 1024;

export const runtime = 'nodejs';

/**
 * POST /api/rag/ingest?tenantId=...
 *
 * Multipart body: one or more PDFs under field name `files` (or repeated `file`).
 * Ingests into the shared in-memory hybrid index for this Node process.
 */
export async function POST(request: NextRequest) {
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

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: 'Formular konnte nicht gelesen werden' }, { status: 400 });
  }

  const rawFiles = [...formData.getAll('files'), ...formData.getAll('file')].filter(
    (entry): entry is File => entry instanceof File && entry.size > 0,
  );

  if (rawFiles.length === 0) {
    return NextResponse.json(
      { error: 'Mindestens eine PDF-Datei erforderlich (Form-Feld „files“ oder „file“).' },
      { status: 400 },
    );
  }

  if (rawFiles.length > MAX_FILES) {
    return NextResponse.json({ error: `Maximal ${MAX_FILES} Dateien pro Anfrage` }, { status: 400 });
  }

  const orchestrator = getRagComplianceOrchestrator();
  const results: Array<{
    readonly fileName: string;
    readonly chunkCount: number;
    readonly ok: boolean;
    readonly error?: string;
  }> = [];

  for (const file of rawFiles) {
    if (file.type !== 'application/pdf') {
      results.push({
        fileName: basename(file.name) || 'upload.pdf',
        chunkCount: 0,
        ok: false,
        error: 'Nur PDF-Dateien (application/pdf) sind erlaubt',
      });
      continue;
    }

    if (file.size > MAX_BYTES) {
      results.push({
        fileName: basename(file.name) || 'upload.pdf',
        chunkCount: 0,
        ok: false,
        error: 'Datei zu groß (max 10 MB)',
      });
      continue;
    }

    const fileName = basename(file.name).slice(0, 255) || 'document.pdf';

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const { chunkCount } = await orchestrator.ingestPdf({
        tenantId,
        fileName,
        pdf: buffer,
      });

      if (chunkCount === 0) {
        results.push({
          fileName,
          chunkCount: 0,
          ok: false,
          error: 'Keine Chunks erzeugt (kein extrahierbarer Text)',
        });
      } else {
        results.push({ fileName, chunkCount, ok: true });
      }
    } catch (err) {
      results.push({
        fileName,
        chunkCount: 0,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const indexStats = getRagIndexStatsForTenant(tenantId);
  const totalChunksAdded = results.filter((r) => r.ok).reduce((sum, r) => sum + r.chunkCount, 0);

  return NextResponse.json({
    tenantId,
    results,
    totalChunksAdded,
    indexStats,
  });
}
