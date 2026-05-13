import { NextRequest, NextResponse } from 'next/server';
import { generateQRCodeAsFile } from '@/app/services/qrCodeService';
import { assertSafeProductId, sanitizeFilenameToken } from '@/app/lib/security/safeProductId';

/**
 * POST /api/qr-code/download
 * Generiert einen QR-Code als PNG-Datei zum Download.
 * 
 * Body:
 * {
 *   productId: string
 * }
 * 
 * Response: PNG Binary (application/octet-stream)
 */
export async function POST(request: NextRequest) {
  try {
    const { productId } = await request.json();

    if (!productId || typeof productId !== 'string') {
      return NextResponse.json(
        { error: 'productId erforderlich' },
        { status: 400 }
      );
    }

    let safeId: string;

    try {
      safeId = assertSafeProductId(productId);
    } catch {
      return NextResponse.json({ error: 'Ungültige productId' }, { status: 400 });
    }

    const buffer = await generateQRCodeAsFile(safeId);
    const fileToken = sanitizeFilenameToken(safeId);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="dpp-${fileToken}-qr.png"`,
      },
    });
  } catch (error) {
    console.error('QR-Code Download fehlgeschlagen:', error);
    return NextResponse.json(
      {
        error: 'Download fehlgeschlagen',
        details: error instanceof Error ? error.message : 'Unbekannt',
      },
      { status: 500 }
    );
  }
}
