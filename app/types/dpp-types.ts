/**
 * ===== DIGITALE PRODUKTPASS TYPEN =====
 * 
 * Unterstützt ALLE EU-Verordnungen für Produktpässe:
 * - ESPR (Batterien) ab 2026
 * - ESPR (Textilien) ab 2027
 * - Digital Product Passport (Elektronik) geplant
 * - Farben & Lacke (PCP) ab 2024
 * - Schmierstoffe ab 2025
 * - Reifen ab 2027
 * - Kunststofferzeugnisse ab 2026
 * - Waschmaschinen ab 2025
 * - Kühlgeräte ab 2026
 * - Beleuchtung ab 2026
 * - Möbel ab 2027
 * - Chemikalien ab 2028
 */

/**
 * Basis-Interface für alle Produktpässe.
 * Enthält Felder, die für jede EU-Regulierung identisch sind. 
 */
export interface BaseDPP {
  readonly id: string;
  readonly createdAt: Date;
  readonly language: string; // ISO 639-1 Code: 'de', 'en', 'fr', 'it', 'es', etc.
  hersteller: string;
  modellname: string;
  [key: string]: any; // Dynamische Felder
}

/**
 * Batterien (ESPR - ab 2026)
 */
export interface BatteryDPP extends BaseDPP {
  readonly type: 'BATTERY';
  kapazitaetKWh?: number;
  chemischesSystem?: string;
  batterietyp?: string;
  seriennummer?: string;
  nennspannungV?: number;
  gewichtKg?: number;
  produktionsdatum?: Date;
  co2FussabdruckKgGesamt?: number;
  co2FussabdruckKgProKwh?: number;
  recyclinganteilKobalt?: number;
  recyclinganteilLithium?: number;
  recyclinganteilNickel?: number;
  erwarteteLebensdauerLadezyklen?: number;
  reparierbarkeitsIndex?: number;
  ersatzteileVerfuegbarkeitJahre?: number;
  recyclingAnweisungen?: string;
  zertifizierungsstelle?: string;
  referenznummer?: string;
  rechtlicheHinweise?: string;
}

/**
 * Textilien (ESPR - ab 2027)
 */
export interface TextileDPP extends BaseDPP {
  readonly type: 'TEXTILE';
  materialZusammensetzung?: string;
  herkunftsland?: string;
  verarbeitungsland?: string;
  pflegehinweise?: string;
  nachhaltigkeit?: string;
}

/**
 * Elektronik & Digital Produkte (geplant)
 */
export interface ElectronicsDPP extends BaseDPP {
  readonly type: 'ELECTRONICS';
  produkttyp?: string;
  stromverbrauch?: number;
  energieeffizienzklasse?: string;
  lebensdauer?: number;
  reparierbarkeit?: string;
  updatefrequenz?: string;
  sicherheitsmerkmale?: string;
}

/**
 * Möbel (ab 2027)
 */
export interface FurnitureDPP extends BaseDPP {
  readonly type: 'FURNITURE';
  material?: string;
  abmessungen?: string;
  gewicht?: number;
  zerlegbarkeit?: string;
  nachhaltigkeitszertifikat?: string;
  herkunftslander?: string[];
}

/**
 * Farben & Lacke (PCP - ab 2024)
 */
export interface PaintDPP extends BaseDPP {
  readonly type: 'PAINT';
  zusammensetzung?: string;
  gefahrenstoffe?: string[];
  verwendung?: string;
  lagerbedingungen?: string;
  entsorgungshinweise?: string;
  voc?: number; // Volatile Organic Compounds
}

/**
 * Schmierstoffe (ab 2025)
 */
export interface LubricantDPP extends BaseDPP {
  readonly type: 'LUBRICANT';
  zusammensetzung?: string;
  viskositaet?: string;
  temperaturbereich?: string;
  gefahrenstoffe?: string[];
  umweltfreundlichkeit?: string;
  verwendungsbereich?: string;
}

/**
 * Reifen (ab 2027)
 */
export interface TyreDPP extends BaseDPP {
  readonly type: 'TYRE';
  reifengross?: string;
  lastindex?: string;
  geschwindigkeitsindex?: string;
  energieeffizienz?: string;
  nassgriffleistung?: string;
  aussengeraeusch?: number;
  recyclingmerkmale?: string;
}

/**
 * Kunststofferzeugnisse (ab 2026)
 */
export interface PlasticDPP extends BaseDPP {
  readonly type: 'PLASTIC';
  kunststoffart?: string;
  recyclinggehalt?: number;
  recyclingfaehigkeit?: string;
  abbaubarkeit?: string;
  herkunftsrohstoffe?: string;
  verwendungszweck?: string;
}

/**
 * Waschmaschinen (ab 2025)
 */
export interface WasherDPP extends BaseDPP {
  readonly type: 'WASHER';
  energie_kwh?: number;
  wasser_liter?: number;
  kapazitaet_kg?: number;
  geraeusch_db?: number;
  haltbarkeit_jahre?: number;
  reparierbarkeit?: string;
  ersatzteilverlfuegbarkeit?: number;
}

/**
 * Kühlgeräte (ab 2026)
 */
export interface RefrigeratorDPP extends BaseDPP {
  readonly type: 'REFRIGERATOR';
  volumen_liter?: number;
  energieverbrauch_kwh?: number;
  klimaklasse?: string;
  geraeusch_db?: number;
  kuehlmittel?: string;
  energieeffizienz?: string;
  haltbarkeit_jahre?: number;
}

/**
 * Beleuchtung (ab 2026)
 */
export interface LightingDPP extends BaseDPP {
  readonly type: 'LIGHTING';
  leuchtenart?: string;
  leistung_watt?: number;
  lichtstrom_lumen?: number;
  farbtemperatur_kelvin?: number;
  lebensdauer_std?: number;
  energieeffizienzklasse?: string;
  quecksilbergehalt?: string;
}

/**
 * Chemikalien allgemein (ab 2028)
 */
export interface ChemicalDPP extends BaseDPP {
  readonly type: 'CHEMICAL';
  zusammensetzung?: string;
  gefahrenstoffe?: string[];
  verwendung?: string;
  lagerbedingungen?: string;
  entsorgungshinweise?: string;
  sicherheitsdatenblatt?: string;
}

/**
 * Generischer/Fallback Produkttyp für unbekannte oder zukünftige Kategorien.
 */
export interface GenericDPP extends BaseDPP {
  readonly type: 'OTHER';
  [key: string]: any;
}

/**
 * Union Type für alle Produktpässe - automatische Erweiterbarkeit
 */
export type ProductPassport = 
  | BatteryDPP 
  | TextileDPP 
  | ElectronicsDPP 
  | FurnitureDPP 
  | PaintDPP 
  | LubricantDPP 
  | TyreDPP 
  | PlasticDPP 
  | WasherDPP 
  | RefrigeratorDPP 
  | LightingDPP 
  | ChemicalDPP 
  | GenericDPP;

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