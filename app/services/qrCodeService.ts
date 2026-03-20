import QRCode from 'qrcode';

/**
 * QR-Code Service – Generiert und validiert QR-Codes für DPP-Links.
 * 
 * Strategien:
 * - Standard DPP Link: https://dpp-flash.de/p/{productId}
 * - GS1 Digital Link: https://gs1.example.com/01/{gtin}/...
 * - Fallback zu localhost für lokale Tests
 */

const BASE_URL = process.env.NEXT_PUBLIC_DPP_URL || 'http://localhost:3000';

/**
 * Generiert einen QR-Code als DataURL (Base64 PNG).
 * 
 * @param productId - Eindeutige Produkt-ID
 * @param options - Optional: GS1-Integration, Größe, etc.
 * @returns Base64-encoded QR-Code Bild
 */
export async function generateQRCode(
  productId: string,
  options?: {
    gtin?: string; // GS1 Global Trade Item Number
    size?: number; // Pixel-Größe
    format?: 'png' | 'svg';
  }
): Promise<string> {
  const { gtin, size = 300, format = 'png' } = options || {};

  // Konstruiere URL
  const url = constructDppUrl(productId, gtin);

  try {
    if (format === 'svg') {
      // SVG-Format (skalierbar, für Print)
      const qrSvg = await QRCode.toString(url, {
        type: 'svg',
        width: size,
        color: { dark: '#000000', light: '#ffffff' },
        errorCorrectionLevel: 'H', // High: Fehlerkorrekt auf 30% beschädigter Daten
      });
      return qrSvg;
    } else {
      // PNG-Format (Standard)
      const qrDataUrl = await QRCode.toDataURL(url, {
        type: 'image/png',
        width: size,
        color: { dark: '#000000', light: '#ffffff' },
        errorCorrectionLevel: 'H',
      });
      return qrDataUrl;
    }
  } catch (error) {
    throw new Error(
      `QR-Code Generierung fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannt'}`
    );
  }
}

/**
 * Generiert einen QR-Code als File (PNG Binary).
 * Nützlich für Download-Funktionalität.
 * 
 * @param productId - Produkt-ID
 * @param fileName - Output-Dateiname (z.B. "dpp-123.png")
 * @returns Buffer für Download
 */
export async function generateQRCodeAsFile(
  productId: string,
  fileName: string = `dpp-${productId}.png`
): Promise<Buffer> {
  const url = constructDppUrl(productId);

  try {
    const buffer = await QRCode.toBuffer(url, {
      width: 500, // Höhere Qualität für Print
      errorCorrectionLevel: 'H',
    });
    return buffer;
  } catch (error) {
    throw new Error(`QR-Code Buffer-Generierung fehlgeschlagen: ${error}`);
  }
}

/**
 * Konstruiert die finale DPP-URL (mit optionaler GS1-Integration).
 * 
 * @param productId - Eindeutige ID
 * @param gtin - Optional: GS1 Global Trade Item Number
 * @returns Vollständige URL
 */
function constructDppUrl(productId: string, gtin?: string): string {
  if (gtin) {
    // GS1 Digital Link Format (zukünftig)
    // Beispiel: https://gs1.example.com/01/{gtin}/
    return `${BASE_URL}/p/${productId}?gtin=${gtin}`;
  }

  // Standard DPP-Link
  return `${BASE_URL}/p/${productId}`;
}

/**
 * Validiert, dass eine QR-Code URL korrekt formatiert ist.
 * (Für Testing & Audit)
 */
export function validateQRCodeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.pathname.startsWith('/p/') && parsed.pathname.split('/').length >= 3;
  } catch {
    return false;
  }
}
