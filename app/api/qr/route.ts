/**
 * Alte QR-Code Route (deprecated).
 * 
 * ❌ Nutze stattdessen:
 * - POST /api/qr-code (Generierung)
 * - POST /api/qr-code/download (Download)
 * 
 * Diese Datei wird bald gelöscht. Migration zu neuen Routes empfohlen.
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      error: 'Route deprecated',
      message: 'Nutze stattdessen POST /api/qr-code oder POST /api/qr-code/download',
      documentation: 'Siehe QR_CODE_GUIDE.md',
    },
    { status: 410 }
  );
}