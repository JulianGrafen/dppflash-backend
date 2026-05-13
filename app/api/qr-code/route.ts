import { NextRequest, NextResponse } from 'next/server';
import { generateQRCode } from '@/app/services/qrCodeService';
import { assertSafeProductId } from '@/app/lib/security/safeProductId';

/**
 * POST /api/qr-code
 * Generiert einen QR-Code als Data URL (Base64 PNG).
 * 
 * Body:
 * {
 *   productId: string,
 *   gtin?: string (optional GS1 Global Trade Item Number)
 * }
 * 
 * Response:
 * {
 *   qrCodeDataUrl: string (Base64 PNG)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { productId, gtin } = await request.json();

    if (!productId || typeof productId !== 'string') {
      return NextResponse.json(
        { error: 'productId erforderlich' },
        { status: 400 }
      );
    }

    try {
      assertSafeProductId(productId);
    } catch {
      return NextResponse.json({ error: 'Ungültige productId' }, { status: 400 });
    }

    const qrCodeDataUrl = await generateQRCode(productId, {
      gtin,
      size: 300,
      format: 'png',
    });

    return NextResponse.json(
      { qrCodeDataUrl },
      { status: 200 }
    );
  } catch (error) {
    console.error('QR-Code Generierung fehlgeschlagen:', error);
    return NextResponse.json(
      {
        error: 'QR-Code Generierung fehlgeschlagen',
        details: error instanceof Error ? error.message : 'Unbekannt',
      },
      { status: 500 }
    );
  }
}
