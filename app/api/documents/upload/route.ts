import { basename } from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { ProductPassportRagEnrichmentService } from '@/app/application/services/rag/ProductPassportRagEnrichmentService';
import { resolveRequestPublicOrigin } from '@/app/lib/resolveRequestPublicOrigin';
import { assertSafeProductId } from '@/app/lib/security/safeProductId';
import { saveProductToStore } from '@/app/lib/server-store';
import { getRagComplianceOrchestrator } from '@/app/infrastructure/rag/ragServerSingleton';
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

const INTERNAL_RESPONSE_FIELDS = new Set(['id', 'type', 'createdAt']);
const SUPPORTED_PRODUCT_TYPES = new Set<ProductPassport['type']>([
  'BATTERY',
  'TEXTILE',
  'ELECTRONICS',
  'FURNITURE',
  'CHEMICAL',
  'OTHER',
]);

function parseProductType(value: string | null): ProductPassport['type'] | undefined {
  if (!value || !SUPPORTED_PRODUCT_TYPES.has(value as ProductPassport['type'])) {
    return undefined;
  }

  return value as ProductPassport['type'];
}

function toPublicExtractedData(
  productType: string,
  extractedFields: Record<string, unknown>
): Record<string, unknown> {
  return {
    productType,
    ...Object.fromEntries(
      Object.entries(extractedFields).filter(([key, value]) => (
        !INTERNAL_RESPONSE_FIELDS.has(key)
        && value !== undefined
        && value !== null
        && value !== ''
      )),
    ),
  };
}

/**
 * POST /api/documents/upload
 * 
 * Nimmt eine PDF-Datei entgegen und startet die Verarbeitungs-Pipeline:
 * 1. Speichern in Supabase Storage
 * 2. Azure AI Document Intelligence analysiert das PDF
 * 3. Azure OpenAI extrahiert das ESPR-DPP-Schema
 * 4. PDF wird in den **RAG-Index** desselben Mandanten eingespeist; forensische LLM-Synthese ergänzt **leere** Passfelder aus den Chunks (mit Audit-Trail auf `ragEnrichment`)
 * 5. **Speichern aller Daten im Store**
 * 6. Rückgabe strukturierter Daten mit Product-Link
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
    const baseUrl = resolveRequestPublicOrigin(request);
    const tenantParam = request.nextUrl.searchParams.get('tenantId');
    const productTypeParam = request.nextUrl.searchParams.get('productType');

    if (!tenantParam?.trim()) {
      return NextResponse.json(
        { error: 'tenantId erforderlich' },
        { status: 400 }
      );
    }

    let safeTenantId: string;
    try {
      safeTenantId = assertSafeProductId(tenantParam.trim());
    } catch {
      return NextResponse.json({ error: 'Ungültiger tenantId' }, { status: 400 });
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
    const productType = parseProductType(productTypeParam);

    const result = await processPdfDocument(
      buffer,
      file.name,
      safeTenantId,
      productType
    );

    const extractedFields = result.extractedData.extractedFields as Record<string, unknown>;
    const hasExtractedFields = Object.keys(extractedFields).length > 0;

    console.info('[DPP] upload_processed', {
      status: result.status,
      confidence: result.extractedData.confidence,
      warningCount: result.extractedData.warnings.length,
    });

    if (result.status === 'FAILED' && !hasExtractedFields) {
      return NextResponse.json(
        {
          error: 'Keine DPP-Daten konnten extrahiert werden.',
          details: result.message,
          warnings: result.extractedData.warnings,
          status: result.status,
        },
        { status: 422 },
      );
    }

    // ===== KRITISCH: SPEICHERE ALLE DATEN IM STORE =====
    const productId = generateProductId();
    const hersteller = typeof extractedFields.hersteller === 'string' ? extractedFields.hersteller : '';
    const modellname = typeof extractedFields.modellname === 'string' ? extractedFields.modellname : '';
    const safeFileName = basename(file.name).slice(0, 255) || 'document.pdf';
    const productPassport: ProductPassport = {
      id: productId,
      type: result.extractedData.productType,
      createdAt: new Date(),
      language: 'de',
      // Speichere ALLE extrahierten Felder, nicht nur ausgewählte
      ...extractedFields,
      hersteller,
      modellname,
      // Speichere Extraktions-Metadaten damit die Produktseite echte Konfidenz zeigt
      extractionConfidence: result.extractedData.confidence,
      extractionWarnings: result.extractedData.warnings,
    } as ProductPassport;

    const rag = getRagComplianceOrchestrator();
    try {
      await rag.ingestPdf({
        tenantId: safeTenantId,
        fileName: safeFileName,
        pdf: buffer,
      });
    } catch (ragIngestErr) {
      console.warn('[DPP] rag_ingest_failed', ragIngestErr);
    }

    const productName =
      typeof extractedFields.productName === 'string' ? extractedFields.productName.trim() : '';
    const productLabel =
      `${hersteller} ${modellname}`.trim() || productName || safeFileName;

    try {
      const enrichmentSvc = new ProductPassportRagEnrichmentService();
      const ragOutcome = await enrichmentSvc.enrichFromIndexedChunks(rag, {
        tenantId: safeTenantId,
        productType: result.extractedData.productType,
        productLabel,
        passport: productPassport,
        sourceFileName: safeFileName,
      });

      if (ragOutcome.enrichment.cryptoValidation.ok) {
        Object.assign(productPassport, ragOutcome.passportPatch);
      }

      productPassport.ragEnrichment = {
        success: true,
        appliedFieldKeys: ragOutcome.enrichment.cryptoValidation.ok ? [...ragOutcome.appliedKeys] : [],
        auditTrail: ragOutcome.enrichment.auditTrail,
        rawModelJson: ragOutcome.enrichment.rawModelJson,
        cryptoValidation: ragOutcome.enrichment.cryptoValidation,
        retrievalMatchConfidence: ragOutcome.retrievalMatchConfidence,
      };
    } catch (ragEnrichErr) {
      console.warn('[DPP] rag_enrich_failed', ragEnrichErr);
      productPassport.ragEnrichment = {
        success: false,
        message: ragEnrichErr instanceof Error ? ragEnrichErr.message : String(ragEnrichErr),
      };
    }

    // Speichere das Produkt
    await saveProductToStore(productPassport);
    console.info('[DPP] product_passport_saved', { productId });

    // ===== RESPONSE MIT PRODUCT-LINK =====
    const responseData = {
      productId,
      productUrl: `${baseUrl}/p/${productId}`,
      documentId: result.documentMetadata.id,
      fileName: result.documentMetadata.fileName,
      uploadedAt: result.documentMetadata.uploadedAt,
      extractedData: toPublicExtractedData(result.extractedData.productType, extractedFields),
      confidence: result.extractedData.confidence,
      warnings: result.extractedData.warnings,
      status: result.status,
      message: result.message,
      ragEnrichment: productPassport.ragEnrichment,
    };

    console.info('[DPP] upload_response_ready', { productId, status: result.status });

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
