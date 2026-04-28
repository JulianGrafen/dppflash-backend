import { storePdfDocument } from './documentStorageService';
import { ProviderRegistry } from './aiProvider';
import { DocumentMetadata, AIExtractionOutput, ProductPassport } from '../types/dpp-types';
import { DppValidationError } from '@/app/domain/dpp/dppSchema';
import { createAzureDppExtractionService } from '@/app/infrastructure/composition/dppExtractionComposition';

/**
 * Document Processing Pipeline – End-to-End Orchestrierung.
 * 
 * Workflow:
 * 1. PDF hochladen → in Supabase Storage speichern
 * 2. Azure AI Document Intelligence analysiert das PDF
 * 3. Azure OpenAI extrahiert semantisch das ESPR-DPP-Schema
 * 4. Domain-Validierung prüft Pflichtfelder und Wertebereiche
 * 5. Ergebnis zurück an Nutzer (Human-in-the-Loop)
 * 
 * Fehlerbehandlung auf jede Stufe mit aussagekräftigen Fehlermeldungen.
 */

export interface ProcessingResult {
  documentMetadata: DocumentMetadata;
  extractedData: AIExtractionOutput;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  message: string;
}

/**
 * Verarbeitet eine hochgeladene PDF-Datei end-to-end.
 * 
 * @param file - PDF-Buffer
 * @param fileName - Original-Dateiname
 * @param tenantId - Mandanten-ID
 * @param productTypeHint - Optional: Vermutete Produktkategorie
 * @returns Verarbeitungsergebnis mit Metadaten + Extracted Data
 */
export async function processPdfDocument(
  file: Buffer,
  fileName: string,
  tenantId: string,
  productTypeHint?: ProductPassport['type']
): Promise<ProcessingResult> {
  try {
    // Schritt 1: Speichern der PDF
    let documentMetadata: DocumentMetadata;
    try {
      documentMetadata = await storePdfDocument(file, fileName, tenantId);
    } catch (error) {
      throw new Error(`Speicherfehler: ${error instanceof Error ? error.message : 'Unbekannt'}`);
    }

    // Schritt 2: Hexagonaler Use Case mit Azure-Adaptern.
    try {
      const dppExtractionService = createAzureDppExtractionService();
      const result = await dppExtractionService.extractFromPdf({
        pdf: file,
        fileName,
        productTypeHint,
      });

      documentMetadata.status = 'EXTRACTED';

      return {
        documentMetadata,
        extractedData: {
          productType: 'OTHER',
          confidence: result.confidence,
          extractedFields: {
            type: 'OTHER',
            ...result.dpp,
          } as Partial<ProductPassport>,
          warnings: [...result.warnings],
        },
        status: 'SUCCESS',
        message: 'PDF erfolgreich als validierter ESPR-DPP verarbeitet',
      };
    } catch (error) {
      const warnings = error instanceof DppValidationError
        ? error.issues.map((issue) => `${issue.field}: ${issue.message}`)
        : [`DPP-Extraktion fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannt'}`];

      return {
        documentMetadata,
        extractedData: {
          productType: productTypeHint || 'OTHER',
          confidence: 0,
          extractedFields: {},
          warnings,
        },
        status: error instanceof DppValidationError ? 'PARTIAL' : 'FAILED',
        message: error instanceof DppValidationError
          ? 'DPP-Daten extrahiert, aber ESPR-Pflichtfelder sind nicht valide.'
          : 'DPP-Extraktion fehlgeschlagen.',
      };
    }
  } catch (error) {
    throw error;
  }
}

/**
 * Iterativer Validierungsprozess (Human-in-the-Loop).
 * Nutzer kann Werte korrigieren, System schlägt Alternativen vor.
 * 
 * @param tenantId - Mandanten-ID
 * @param documentId - Dokument-ID
 * @param correctedData - Von Nutzer korrigierte Daten
 * @param undecidedFields - Felder, bei denen der Nutzer Hilfe braucht
 * @returns Validiertes Endergebnis
 */
export async function validateAndCorrect(
  tenantId: string,
  documentId: string,
  correctedData: Partial<ProductPassport>,
  undecidedFields: string[] = []
): Promise<ProductPassport> {
  const aiProvider = ProviderRegistry.getActive();

  // Validiere korrigierte Felder
  const validationPromises = Object.entries(correctedData).map(async ([key, value]) => {
    const isValid = await aiProvider.validateField(
      key,
      value,
      correctedData.type || 'BATTERY'
    );
    return { field: key, isValid, value };
  });

  const validations = await Promise.all(validationPromises);

  // Sammle Fehler
  const errors = validations.filter((v) => !v.isValid).map((v) => v.field);
  if (errors.length > 0) {
    throw new Error(`Validierungsfehler: ${errors.join(', ')}`);
  }

  // Hole Alternativen für unsichere Felder
  if (undecidedFields.length > 0) {
    for (const field of undecidedFields) {
      const alternatives = await aiProvider.suggestAlternatives(
        `Welche Wert ist realistisch für "${field}"?`,
        correctedData
      );
      console.log(`Alternativen für ${field}:`, alternatives);
    }
  }

  return correctedData as ProductPassport;
}
