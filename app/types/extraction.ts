/**
 * Extraction Type System
 *
 * Separates infrastructure concerns (how we read a PDF) from domain concerns
 * (what we do with the text).  These types flow through the entire pipeline:
 *
 *   PdfReader  → RawPdfContent
 *   HeuristicExtractor → ExtractionResult<T>
 *   PdfProcessingService → ProcessingOutcome<T>
 *
 * Design rules
 * ─────────────
 * - `readonly` on every field that must not be mutated after creation.
 * - `undefined` for truly optional data; never `null`.
 * - Generic `<T>` lets the extractor stay typed while the reader stays agnostic.
 */

// ─── Raw reader output ────────────────────────────────────────────────────────

/** The normalised text layer produced by the PDF reader. */
export interface RawPdfContent {
  /** Whitespace-collapsed, junk-stripped plain text across all pages. */
  readonly text: string;
  readonly pageCount: number;
  readonly fileName: string;
  /** Extraction strategy that produced this content. */
  readonly strategy: 'pdfjs' | 'pdf-parse' | 'binary-scan';
  readonly extractedAt: string; // ISO 8601
  readonly durationMs: number;
}

// ─── Heuristic extractor output ───────────────────────────────────────────────

/**
 * A single field value found by the extractor.
 * Carries the matched text, normalised value, and optional diagnostic metadata.
 */
export interface ExtractedField<V = string | number | undefined> {
  readonly value: V;
  /** Human-readable description of which heuristic found the value. */
  readonly source: string;
  /** 0–1 confidence specific to this field. */
  readonly fieldConfidence: number;
}

/** Map of field name → extracted field detail. Fully typed over the domain shape T. */
export type ExtractionFieldMap<T> = {
  [K in keyof T]?: ExtractedField<T[K]>;
};

/** Aggregate result from one extractor run. */
export interface ExtractionResult<T> {
  /** Normalised domain object (missing fields are `undefined`, never empty strings). */
  readonly data: Partial<T>;
  /** 0–1 overall confidence (mandatory-field hit rate). */
  readonly confidence: number;
  /** Human-readable diagnostic messages. Empty array on full extraction. */
  readonly warnings: readonly string[];
  /** Per-field provenance — useful for debugging and UI highlighting. */
  readonly fieldMap: ExtractionFieldMap<T>;
}

// ─── Full pipeline outcome ────────────────────────────────────────────────────

export type PipelineStatus = 'SUCCESS' | 'PARTIAL' | 'FAILED';

export interface ProcessingOutcome<T> {
  readonly status: PipelineStatus;
  /** Set when status is SUCCESS or PARTIAL. */
  readonly raw?: RawPdfContent;
  readonly result?: ExtractionResult<T>;
  /** Top-level human-readable message for the UI. */
  readonly message: string;
}

// ─── Extractor strategy contract (Strategy Pattern) ──────────────────────────

/**
 * Any class implementing this interface can be hot-swapped into the pipeline
 * without changing PdfProcessingService.
 */
export interface IHeuristicExtractor<T> {
  /** Domain name; used for logging and the extractor registry. */
  readonly name: string;
  /**
   * Convert raw PDF text into a typed, partial domain object.
   * MUST NOT throw — return an empty result with warnings instead.
   */
  extract(rawText: string): ExtractionResult<T>;
}
