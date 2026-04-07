import { NextRequest, NextResponse } from 'next/server';
import { saveProductToStore } from '@/app/lib/server-store';
import { ProductPassport } from '@/app/types/dpp-types';

/**
 * Generiert eine kurze eindeutige ID
 */
function generateProductId(): string {
  // Kombiniert Timestamp + zufällige Teile für eine lesbare ID
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `prod_${timestamp}_${random}`.substring(0, 30);
}

/**
 * POST /api/documents/upload
 * 
 * Nimmt eine PDF-Datei entgegen und startet die Verarbeitungs-Pipeline:
 * 1. Speichern in Supabase Storage
 * 2. Lokale Extraktion (pdf-parse)
 * 3. AI-Strukturierung (OpenAI)
 * 4. **Speichern aller Daten im Store**
 * 5. Rückgabe strukturierter Daten mit Product-Link
 * 
 * Query-Parameter:
 * - tenantId: Mandanten-ID (erforderlich für Multi-Tenancy)
 * - productType: Optional, "BATTERY", "TEXTILE", "ELECTRONICS", "FURNITURE", "CHEMICAL"
 * 
 * Rückgabe:
 * - 200: Erfolg mit extractedData + productId für direkten Link
 * - 400: Ungültige Eingabe (keine Datei, falscher Typ)
 * - 500: Server-Fehler (Speicher, AI-Fehler)
 */
export async function POST(request: NextRequest) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_DPP_URL || request.nextUrl.origin;
    const tenantId = request.nextUrl.searchParams.get('tenantId');
    const productTypeParam = request.nextUrl.searchParams.get('productType');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId erforderlich' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'Keine PDF-Datei gefunden' },
        { status: 400 }
      );
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Nur PDF-Dateien erlaubt' },
        { status: 400 }
      );
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'Datei zu groß (max 10 MB)' },
        { status: 400 }
      );
    }

    // Dynamischer Import für bessere Build-Performance
    const { processPdfDocument } = await import(
      '@/app/services/documentProcessingService'
    );

    const buffer = Buffer.from(await file.arrayBuffer());
    const productType = productTypeParam as any;

    const result = await processPdfDocument(
      buffer,
      file.name,
      tenantId,
      productType
    );

    const extractedFields = result.extractedData.extractedFields as any;

    console.log('📤 Upload Response wird zusammengestellt:');
    console.log('  extractedFields:', extractedFields);
    console.log('  hersteller:', extractedFields.hersteller);
    console.log('  modellname:', extractedFields.modellname);

    // ===== KRITISCH: SPEICHERE ALLE DATEN IM STORE =====
    const productId = generateProductId();
    const productPassport: ProductPassport = {
      id: productId,
      type: result.extractedData.productType,
      createdAt: new Date(),
      // Speichere ALLE extrahierten Felder, nicht nur ausgewählte
      ...extractedFields,
    } as any;

    // Speichere das Produkt
    await saveProductToStore(productPassport);
    console.log(`✅ Produkt gespeichert mit ID: ${productId}`);

    // ===== RESPONSE MIT PRODUCT-LINK =====
    const responseData = {
      productId,
      productUrl: `${baseUrl}/p/${productId}`,
      documentId: result.documentMetadata.id,
      fileName: result.documentMetadata.fileName,
      uploadedAt: result.documentMetadata.uploadedAt,
      extractedData: {
        productType: result.extractedData.productType,
        // Return ALL extracted fields — let the client decide what to show
        ...extractedFields,
      },
      confidence: result.extractedData.confidence,
      warnings: result.extractedData.warnings,
      status: result.status,
      message: result.message,
    };

    console.log('📤 Final Response:', { productId, product_url: responseData.productUrl });

    return NextResponse.json(
      responseData,
      { status: result.status === 'SUCCESS' ? 200 : 202 }
    );
  } catch (error) {
    console.error('Upload-Fehler:', error);
    return NextResponse.json(
      {
        error: 'Fehler beim Hochladen',
        details: error instanceof Error ? error.message : 'Unbekannt',
      },
      { status: 500 }
    );
  }
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
