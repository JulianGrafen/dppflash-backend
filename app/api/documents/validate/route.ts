import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/documents/validate
 * 
 * ⚠️ Alpha Feature: Wird in MVP noch optimiert
 * Nutze stattdessen `/api/products` für Product Storage
 */
export async function POST(request: NextRequest) {
  try {
    // Dynamischer Import für bessere Build-Performance
    const { validateAndCorrect } = await import(
      '@/app/services/documentProcessingService'
    );

    const body = await request.json();
    const { tenantId, documentId, correctedData, undecidedFields } = body;

    if (!tenantId || !documentId || !correctedData) {
      return NextResponse.json(
        { error: 'tenantId, documentId, correctedData erforderlich' },
        { status: 400 }
      );
    }

    const requiredFields = ['hersteller', 'modellname', 'type'];
    const missingFields = requiredFields.filter((f) => !correctedData[f]);

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Pflichtfelder erforderlich: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    const validatedData = await validateAndCorrect(
      tenantId,
      documentId,
      correctedData,
      undecidedFields || []
    );

    return NextResponse.json(
      {
        success: true,
        validatedData,
        message: 'Daten erfolgreich validiert',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Validierungs-Fehler:', error);
    return NextResponse.json(
      {
        error: 'Validierung fehlgeschlagen',
        details: error instanceof Error ? error.message : 'Unbekannt',
      },
      { status: 500 }
    );
  }
}
