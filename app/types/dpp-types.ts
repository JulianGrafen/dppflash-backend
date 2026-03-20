/**
 * Basis-Interface für alle Produktpässe.
 * Enthält Felder, die für jede EU-Regulierung (ESPR) identisch sind. 
 */
export interface BaseDPP {
  readonly id: string;
  readonly createdAt: Date;
  hersteller: string;
  modellname: string;
}

/**
 * Spezifische Anforderungen für Batterien (Pflicht ab 2026 nach ESPR). 
 * Enthält alle Felder aus EU-Verordnung 2023/2863 für Batterie-Zertifikate.
 */
export interface BatteryDPP extends BaseDPP {
  readonly type: 'BATTERY';
  // Basis-Spezifikationen
  kapazitaetKWh: number;
  chemischesSystem: string;
  batterietyp?: string; // z.B. "Lithium-Ionen-Akku (>2 kWh)"
  produktionsdatum?: Date;
  
  // Nachhaltigkeit und Materialzusammensetzung
  recyclinganteilKobalt?: number; // Prozentanteil
  recyclinganteilLithium?: number;
  recyclinganteilNickel?: number;
  co2FussabdruckKgProKwh?: number;
  
  // Haltbarkeit und Wartung
  erwarteteLebensdauerLadezyklen?: number;
  reparierbarkeitsIndex?: number; // z.B. 8.5 / 10
  ersatzteileVerfuegbarkeitJahre?: number;
  
  // Entsorgung und Recycling
  recyclingAnweisungen?: string;
  garantierteDataAvailabilityJahre?: number; // z.B. bis 2041
}

/**
 * Spezifische Anforderungen für Textilien (Pflicht ab ca. 2027). 
 */
export interface TextileDPP extends BaseDPP {
  readonly type: 'TEXTILE';
  materialZusammensetzung: string;
  herkunftsland: string;
}

/** * Union Type für einfache Erweiterbarkeit um künftige Kategorien wie Möbel oder Elektronik. 
 */
export type ProductPassport = BatteryDPP | TextileDPP;

/**
 * Document Upload Metadaten – speichert Informationen über hochgeladene PDFs.
 * Wird in Supabase Storage + Database gespeichert.
 */
export interface DocumentMetadata {
  readonly id: string;
  readonly tenantId: string; // Multi-Tenancy
  fileName: string;
  fileSize: number; // in Bytes
  filePath: string; // Pfad in Supabase Storage
  mimeType: string;
  readonly uploadedAt: Date;
  extractedText?: string; // Extrahierter Rohtext aus PDF (lokal verarbeitet)
  status: 'PENDING' | 'EXTRACTED' | 'VALIDATED' | 'FAILED';
  errorMessage?: string;
}

/**
 * Extraction Result – Rohausgang aus PDF-Parser.
 * Enthält den unverarbeiteten Text für Validierung/Fehlerbehandlung.
 */
export interface ExtractionResult {
  text: string;
  pageCount: number;
  metadata: Record<string, unknown>;
  extractionDuration: number; // ms
}

/**
 * AI-Structured Output – von OpenAI basierend auf Extraction Result.
 * Wird nach DSGVO-Compliance lokal verarbeitet.
 */
export interface AIExtractionOutput {
  productType: ProductPassport['type'];
  confidence: number; // 0-1
  extractedFields: Partial<ProductPassport>;
  warnings: string[];
}