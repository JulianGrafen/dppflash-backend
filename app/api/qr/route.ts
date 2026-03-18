import { NextRequest } from 'next/server';
import QRCode from 'qrcode';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const productId = params.id;
  
  // Die URL, die im QR-Code kodiert wird
  // Realistisch: Verweis auf die öffentliche DPP-Ansicht
  const dppUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://dpp-flash.de'}/p/${productId}`;

  try {
    // Generiert den QR-Code als Data-URL (Base64) oder Buffer
    // Wir nutzen hier den Buffer für eine direkte Bild-Antwort
    const qrCodeBuffer = await QRCode.toBuffer(dppUrl, {
      errorCorrectionLevel: 'H', // High: Wichtig für Druck auf Verpackungen (Robustheit)
      margin: 1,
      width: 400,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });

    const responseBody = new Uint8Array(qrCodeBuffer);

return new Response(responseBody, {
  headers: {
    'Content-Type': 'image/png',
    'Cache-Control': 'public, max-age=31536000, immutable',
  },
});
  } catch (err) {
    console.error('QR Generierung fehlgeschlagen:', err);
    return new Response('Fehler bei der QR-Code Erstellung', { status: 500 });
  }
}