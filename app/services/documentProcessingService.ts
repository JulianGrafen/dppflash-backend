import { extractPdfText, isValidExtractionText } from './pdfExtractionService';
import { storePdfDocument, getPdfDocument } from './documentStorageService';
import { ProviderRegistry } from './aiProvider';
import { DocumentMetadata, AIExtractionOutput, ProductPassport } from '../types/dpp-types';

/**
 * Document Processing Pipeline – End-to-End Orchestrierung.
 * 
 * Workflow:
 * 1. PDF hochladen → in Supabase Storage speichern
 * 2. Lokale Extraktion mit pdf-parse
 * 3. Validierung des Rohtexts
 * 4. Sende zu OpenAI für Strukturierung (DSGVO-konform)
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

    // Schritt 2: Lokale PDF-Extraktion (DSGVO-konform)
    let rawText: string;
    try {
      const result = await extractPdfText(file, fileName);
      rawText = result.text;
      documentMetadata.extractedText = rawText;
    } catch (error) {
      return {
        documentMetadata,
        extractedData: { productType: productTypeHint || 'BATTERY', confidence: 0, extractedFields: {}, warnings: [`Extraktion fehlgeschlagen: ${error}`] },
        status: 'FAILED',
        message: `PDF-Extraktion fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannt'}`,
      };
    }

    // Schritt 3: Validierung Rohtext (nur Warnung – Extraktion wird trotzdem versucht)
    if (!isValidExtractionText(rawText)) {
      console.warn('⚠️ PDF-Text möglicherweise unvollständig, Extraktion wird trotzdem versucht.');
    }

    // Schritt 4: AI-Strukturierung (nur Rohtext zu OpenAI)
    let extractedData: AIExtractionOutput;
    try {
      const aiProvider = ProviderRegistry.getActive();
      console.log('📄 AI-Provider aktiv, starte Extraktion...', { rawText: rawText.substring(0, 200) });
      extractedData = await aiProvider.extractProductData(rawText, productTypeHint);
      console.log('✅ AI-Extraktion fertig:', { 
        productType: extractedData.productType, 
        confidence: extractedData.confidence,
        hersteller: extractedData.extractedFields.hersteller,
        modellname: extractedData.extractedFields.modellname
      });
    } catch (error) {
      return {
        documentMetadata,
        extractedData: {
          productType: productTypeHint || 'BATTERY',
          confidence: 0.5,
          extractedFields: {},
          warnings: [`AI-Strukturierung fehlgeschlagen, manuelle Eingabe erforderlich: ${error}`],
        },
        status: 'PARTIAL',
        message: 'AI konnte Daten nicht vollständig extrahieren. Bitte manuell überprüfen.',
      };
    }

    documentMetadata.status = 'EXTRACTED';

    return {
      documentMetadata,
      extractedData,
      status: 'SUCCESS',
      message: 'PDF erfolgreich verarbeitet',
    };
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
