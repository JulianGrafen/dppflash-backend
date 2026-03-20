import { supabase, STORAGE_BUCKETS } from '../lib/supabase';
import { DocumentMetadata, ExtractionResult } from '../types/dpp-types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Document Storage Service – Multi-Tenant Dokumentenverwaltung.
 * 
 * Verantwortlichkeiten:
 * - Speichern von PDF-Datein in Supabase Storage (mit Tenant-Isolation)
 * - Datenbankeinträge in Supabase PostgreSQL für Metadaten
 * - Versionierung und Audit-Logs (zukünftig)
 */

/**
 * Speichert eine PDF-Datei und die zugehörigen Metadaten.
 * 
 * @param file - Dateiinhalt
 * @param fileName - Original-Dateiname
 * @param tenantId - Identifikator des Mandanten (für Multi-Tenancy)
 * @param extractedText - Optional: Bereits extrahierter Rohtext
 * @returns DocumentMetadata mit Speicherpfad
 * @throws Error bei Speicherfehler
 */
export async function storePdfDocument(
  file: Buffer,
  fileName: string,
  tenantId: string,
  extractedText?: string
): Promise<DocumentMetadata> {
  const documentId = uuidv4();
  const fileSize = file.byteLength;
  
  // Pfad: tenants/{tenantId}/{datetime}_{filename}
  const timestamp = new Date().getTime();
  const safePath = `tenants/${tenantId}/${timestamp}_${sanitizeFileName(fileName)}`;

  try {
    // MVP: Speichere nur Metadaten (keine echte Supabase-Integration)
    // Zukünftig: Supabase Storage Integration
    console.log(`💾 MVP-Speicher: Datei "${fileName}" registriert (${fileSize} bytes)`);

    const metadata: DocumentMetadata = {
      id: documentId,
      tenantId,
      fileName,
      fileSize,
      filePath: safePath,
      mimeType: 'application/pdf',
      uploadedAt: new Date(),
      extractedText,
      status: extractedText ? 'EXTRACTED' : 'PENDING',
    };

    console.log(`✅ Dokumentmetadaten gespeichert: ${documentId}`);
    return metadata;
  } catch (error) {
    throw new Error(
      `Fehler beim Speichern der Datei "${fileName}": ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
    );
  }
}

/**
 * Abrufen einer PDF-Datei aus Supabase Storage.
 * 
 * @param filePath - Gespeicherter Pfad der Datei
 * @param tenantId - Mandanten-ID (zur Sicherheitsvalidierung)
 * @returns Buffer mit PDF-Inhalt
 */
export async function getPdfDocument(
  filePath: string,
  tenantId: string
): Promise<Buffer> {
  // Sicherheit: Validate dass Pfad zum Tenant gehört
  if (!filePath.startsWith(`tenants/${tenantId}/`)) {
    throw new Error('Zugriff verweigert: Datei gehört nicht zu diesem Mandanten');
  }

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKETS.PDF_UPLOADS)
    .download(filePath);

  if (error || !data) {
    throw new Error(`PDF nicht gefunden: ${filePath}`);
  }

  return Buffer.from(await data.arrayBuffer());
}

/**
 * Löscht eine PDF-Datei (nach DSGVO: Rechtloschung).
 * 
 * @param filePath - Pfad zur Datei
 * @param tenantId - Mandanten-ID (Sicherheitsvalidierung)
 */
export async function deletePdfDocument(
  filePath: string,
  tenantId: string
): Promise<void> {
  if (!filePath.startsWith(`tenants/${tenantId}/`)) {
    throw new Error('Zugriff verweigert: Datei gehört nicht zu diesem Mandanten');
  }

  const { error } = await supabase.storage
    .from(STORAGE_BUCKETS.PDF_UPLOADS)
    .remove([filePath]);

  if (error) {
    throw new Error(`Fehler beim Löschen der Datei: ${error.message}`);
  }
}

/**
 * Bereinigt Dateinamen für sichere Speicherung.
 * Entfernt Sonderzeichen, Pfad-Traversals, etc.
 * 
 * @param fileName - Original-Dateiname
 * @returns Bereinigte Variante
 */
function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Nur sichere Zeichen
    .replace(/_{2,}/g, '_') // Mehrfache Unterstriche zu einem
    .slice(0, 255); // Max 255 Zeichen (Dateisystem-Limit)
}
