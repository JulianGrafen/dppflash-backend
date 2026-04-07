/**
 * POST /api/upload
 *
 * Pipeline:
 *   Validate PDF → Extract ESPR fields → Persist → Generate QR → Respond
 *
 * All heavy lifting lives in localExtractionService (swappable via IExtractor).
 * Persistence uses server-store (Supabase-backed, Vercel-safe).
 */
import { NextRequest, NextResponse } from 'next/server';
import { extractFromPdfBuffer } from '@/app/services/localExtractionService';
import { saveProductToStore } from '@/app/lib/server-store';
import { generateQRCode } from '@/app/services/qrCodeService';
import type { UploadApiResponse } from '@/app/types/espr';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB





// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
): Promise<NextResponse<UploadApiResponse>> {
  // 1. Parse multipart form
  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json(
      { success: false, error: 'Ungültige Formulardaten.' },
      { status: 400 },
    );
  }

  // 2. Validate file
  const file = formData.get('file');
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json(
      { success: false, error: "Kein File unter dem Key 'file' gefunden." },
      { status: 400 },
    );
  }
  if (file.type !== 'application/pdf') {
    return NextResponse.json(
      { success: false, error: `Nur PDF-Dateien erlaubt (erhalten: ${file.type}).` },
      { status: 400 },
    );
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { success: false, error: 'Datei zu groß (max 10 MB).' },
      { status: 400 },
    );
  }

  // 3. Extract → persist → generate QR
  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    // IExtractor-backed — swap strategy at runtime with registerExtractor()
    const data = await extractFromPdfBuffer(buffer);

    // BaseDPP has [key: string]: any, so EsprProductData is structurally compatible
    await saveProductToStore(data as any);

    const baseUrl = request.nextUrl.origin;
    const productUrl = `${baseUrl}/p/${data.id}`;
    const qrCodeDataUrl = await generateQRCode(data.id, { size: 300 });

    return NextResponse.json({
      success: true,
      productId: data.id,
      productUrl,
      qrCodeDataUrl,
      data,
    });
  } catch (error) {
    console.error('[POST /api/upload]', error);
    return NextResponse.json(
      { success: false, error: 'Interner Fehler beim Verarbeiten der PDF.' },
      { status: 500 },
    );
  }
}
