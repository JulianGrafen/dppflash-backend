import { NextRequest, NextResponse } from 'next/server';
import { generateQRCode, generateQRCodeAsFile } from '@/app/services/qrCodeService';
import { assertSafeProductId, sanitizeFilenameToken } from '@/app/lib/security/safeProductId';

/**
 * POST /api/qr-code/download
 * Generiert einen QR-Code als PNG-Datei zum Download.
 * 
 * Body:
 * {
 *   productId: string,
 *   format?: "png" | "svg"
 * }
 * 
 * Response: PNG or SVG attachment
 */
export async function POST(request: NextRequest) {
  try {
    const { productId, format = 'png' } = await request.json();

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

    const fileToken = sanitizeFilenameToken(safeId);

    if (format !== 'png' && format !== 'svg') {
      return NextResponse.json({ error: 'format muss png oder svg sein' }, { status: 400 });
    }

    if (format === 'svg') {
      const svg = await generateQRCode(safeId, { format: 'svg', size: 512 });
      return new NextResponse(svg, {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Content-Disposition': `attachment; filename="dpp-${fileToken}-qr.svg"`,
        },
      });
    }

    const buffer = await generateQRCodeAsFile(safeId);

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
