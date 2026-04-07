/**
 * EU ESPR Digital Product Passport — Canonical Type System
 *
 * References:
 *   - EU Battery Regulation 2023/1542  (mandatory from Feb 2027)
 *   - EU ESPR Regulation 2024/1781
 *   - ESPR Implementing Act for batteries (published Dec 2024)
 *
 * Design rules:
 *   - Immutable identity fields use `readonly`.
 *   - All optional ESPR fields use `?` — never `null`.
 *   - Nested value objects group related fields for clarity.
 *   - Flat aliases (`hersteller`, `modellname`) keep backward compat with the store.
 */

// ─── Discriminant ─────────────────────────────────────────────────────────────

export type ProductCategory = 'BATTERY' | 'TEXTILE' | 'ELECTRONICS' | 'FURNITURE';

// ─── Nested value objects ──────────────────────────────────────────────────────

/** Manufacturer identification per ESPR Art. 4 & EU 2023/1542 Art. 77 */
export interface Manufacturer {
  readonly name: string;
  readonly address?: string;
  /** ISO 3166-1 alpha-2, e.g. "DE", "CN" */
  readonly country?: string;
  /** EU Operator Registration and Identification number */
  readonly eoriNumber?: string;
}

/** Carbon footprint declaration per EU 2023/1542 Art. 7 */
export interface CarbonFootprint {
  /** Total CO₂ equivalent (cradle-to-gate), kg CO₂e */
  readonly totalKg?: number;
  /** CO₂ equivalent per kWh of rated capacity, kg CO₂e / kWh */
  readonly perKwhKg?: number;
  /** Calculation methodology, e.g. "ISO 14067:2018" */
  readonly methodology?: string;
  readonly certificationBody?: string;
}

/** Recycled content percentages per EU 2023/1542 Art. 8 */
export interface RecycledContent {
  readonly cobaltPct?: number;
  readonly lithiumPct?: number;
  readonly nickelPct?: number;
  readonly leadPct?: number;
}

/** Lifecycle & repairability per EU 2023/1542 Art. 10 */
export interface Lifecycle {
  /** Expected number of full charge/discharge cycles */
  readonly expectedCycles?: number;
  /** EU repairability index  0–10 */
  readonly repairabilityScore?: number;
  /** Years manufacturer guarantees spare-part availability */
  readonly sparePartsAvailableYears?: number;
  readonly warrantyYears?: number;
}

/** End-of-life information per EU 2023/1542 Art. 11 */
export interface EndOfLife {
  readonly recyclingInstructions?: string;
  readonly disposalInstructions?: string;
  readonly hazardousSubstances?: string[];
}

// ─── Main ESPR product data interface ─────────────────────────────────────────

export interface EsprProductData {
  // Identity — immutable after creation
  readonly id: string;
  readonly createdAt: string;       // ISO 8601 datetime
  readonly language: string;        // ISO 639-1 ('de', 'en', …)
  readonly type: ProductCategory;

  // Manufacturer (ESPR Art. 4)
  readonly manufacturer: Manufacturer;
  /** Flat alias for backward-compatibility with existing store & UI */
  hersteller: string;

  // Product identification
  model: string;
  /** Flat alias for backward-compatibility */
  modellname: string;
  serialNumber?: string;
  batchNumber?: string;
  /** ISO 8601 date, e.g. "2025-03-15" */
  productionDate?: string;

  // Battery technical specification (EU 2023/1542 Annex XIII)
  capacityKwh?: number;
  chemistry?: string;         // "NMC" | "LFP" | "NCA" | …
  batteryType?: string;       // "EV" | "Stationary" | "Industrial"
  nominalVoltageV?: number;
  weightKg?: number;

  // Art. 7 — Carbon footprint
  readonly carbonFootprint: CarbonFootprint;

  // Art. 8 — Recycled content
  readonly recycledContent: RecycledContent;

  // Art. 10 — Lifecycle & repairability
  readonly lifecycle: Lifecycle;

  // Art. 11 — End-of-life
  readonly endOfLife: EndOfLife;

  // Regulatory metadata
  certificationBody?: string;
  regulatoryReference?: string;
  legalNotes?: string;
  supplyChainInfo?: string;

  // Extraction quality
  readonly extractionConfidence: number;    // 0.0–1.0
  readonly extractionWarnings: readonly string[];
}

// ─── API response types ───────────────────────────────────────────────────────

export interface UploadSuccess {
  readonly success: true;
  readonly productId: string;
  readonly productUrl: string;
  readonly qrCodeDataUrl: string;
  readonly data: EsprProductData;
}

export interface UploadFailure {
  readonly success: false;
  readonly error: string;
}

export type UploadApiResponse = UploadSuccess | UploadFailure;
