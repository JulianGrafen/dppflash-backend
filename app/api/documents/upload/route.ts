import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/documents/upload
 * 
 * Nimmt eine PDF-Datei entgegen und startet die Verarbeitungs-Pipeline:
 * 1. Speichern in Supabase Storage
 * 2. Lokale Extraktion (pdf-parse)
 * 3. AI-Strukturierung (OpenAI)
 * 4. Rückgabe strukturierter Daten für Human-in-the-Loop Validation
 * 
 * Query-Parameter:
 * - tenantId: Mandanten-ID (erforderlich für Multi-Tenancy)
 * - productType: Optional, "BATTERY" oder "TEXTILE"
 * 
 * Rückgabe:
 * - 200: Erfolg mit extractedData für Validierungs-UI
 * - 400: Ungültige Eingabe (keine Datei, falscher Typ)
 * - 500: Server-Fehler (Speicher, AI-Fehler)
 */
export async function POST(request: NextRequest) {
  try {
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

    const responseData = {
      documentId: result.documentMetadata.id,
      fileName: result.documentMetadata.fileName,
      uploadedAt: result.documentMetadata.uploadedAt,
      extractedData: {
        productType: result.extractedData.productType,
        hersteller: extractedFields.hersteller,
        modellname: extractedFields.modellname,
        ...(result.extractedData.productType === 'BATTERY' && {
          kapazitaetKWh: extractedFields.kapazitaetKWh,
          chemischesSystem: extractedFields.chemischesSystem,
          // ESPR-spezifische Batterie-Felder
          ...(extractedFields.batterietyp && { batterietyp: extractedFields.batterietyp }),
          ...(extractedFields.produktionsdatum && { produktionsdatum: extractedFields.produktionsdatum }),
          ...(extractedFields.co2FussabdruckKgProKwh && { co2FussabdruckKgProKwh: extractedFields.co2FussabdruckKgProKwh }),
          ...(extractedFields.erwarteteLebensdauerLadezyklen && { erwarteteLebensdauerLadezyklen: extractedFields.erwarteteLebensdauerLadezyklen }),
          ...(extractedFields.reparierbarkeitsIndex && { reparierbarkeitsIndex: extractedFields.reparierbarkeitsIndex }),
          ...(extractedFields.ersatzteileVerfuegbarkeitJahre && { ersatzteileVerfuegbarkeitJahre: extractedFields.ersatzteileVerfuegbarkeitJahre }),
          ...(extractedFields.recyclinganteilKobalt && { recyclinganteilKobalt: extractedFields.recyclinganteilKobalt }),
          ...(extractedFields.recyclinganteilLithium && { recyclinganteilLithium: extractedFields.recyclinganteilLithium }),
          ...(extractedFields.recyclinganteilNickel && { recyclinganteilNickel: extractedFields.recyclinganteilNickel }),
          ...(extractedFields.recyclingAnweisungen && { recyclingAnweisungen: extractedFields.recyclingAnweisungen }),
        }),
        ...(result.extractedData.productType === 'TEXTILE' && {
          materialZusammensetzung: extractedFields.materialZusammensetzung,
          herkunftsland: extractedFields.herkunftsland,
        }),
      },
      confidence: result.extractedData.confidence,
      warnings: result.extractedData.warnings,
      status: result.status,
      message: result.message,
    };

    console.log('📤 Final Response extractedData:', responseData.extractedData);

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
