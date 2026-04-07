/**
 * PdfProcessingService
 *
 * Central orchestration layer for the PDF → structured-data pipeline.
 * Ties PdfReader (text extraction) and IHeuristicExtractor<T> (field parsing)
 * together behind a single async function call.
 *
 * Usage
 * ─────
 *   import { processPdf } from './PdfProcessingService';
 *   import { BatteryHeuristicExtractor } from './extractor/HeuristicExtractor';
 *
 *   const outcome = await processPdf(buffer, 'battery.pdf', new BatteryHeuristicExtractor());
 *   if (outcome.status !== 'FAILED') {
 *     const { hersteller, capacityKwh } = outcome.result!.data;
 *   }
 *
 * Extension
 * ─────────
 * Pass a different extractor instance to handle new product categories
 * (Textile, Electronics, …) without touching this file.
 *
 * GDPR: no data leaves the server — PdfReader and HeuristicExtractor are
 * entirely in-process.
 */

import { readPdf } from '../utils/pdfReader';
import type { IHeuristicExtractor, ProcessingOutcome } from '../types/extraction';

export { BatteryHeuristicExtractor } from './extractor/HeuristicExtractor';

// ─── Text quality guard ───────────────────────────────────────────────────────

const MIN_TEXT_LENGTH = 20;
const MAX_GARBAGE_RATIO = 0.6;

/**
 * Heuristic check: reject text that is mostly non-printable / binary noise.
 * Returns a human-readable reason string when the text is suspicious,
 * or `null` when the text looks fine.
 */
function textQualityWarning(text: string): string | null {
  if (text.length < MIN_TEXT_LENGTH) {
    return `PDF-Text zu kurz (${text.length} Zeichen) — möglicherweise kein Textlayer vorhanden.`;
  }

  const acceptable =
    /[a-zA-Z0-9äöüßÄÖÜ\s\-.,;:()\n%€$\/\[\]'"!?@#*+]/g;
  const goodChars = (text.match(acceptable) ?? []).length;
  const garbageRatio = 1 - goodChars / text.length;

  if (garbageRatio > MAX_GARBAGE_RATIO) {
    return `PDF-Text enthält ${(garbageRatio * 100).toFixed(1)} % Sonderzeichen (max. ${MAX_GARBAGE_RATIO * 100} %) — PDF möglicherweise gescannt ohne OCR.`;
  }

  return null;
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * End-to-end PDF processing: read → validate → extract.
 *
 * @param buffer      Raw PDF bytes — stays in process, never leaves the server.
 * @param fileName    Used for logging and error messages only.
 * @param extractor   Domain-specific heuristic extractor (Strategy Pattern).
 *
 * @returns `ProcessingOutcome<T>`:
 *   - `SUCCESS`  — all mandatory fields found
 *   - `PARTIAL`  — some fields missing, review recommended
 *   - `FAILED`   — could not extract any readable text from the PDF
 */
export async function processPdf<T>(
  buffer: Buffer,
  fileName: string,
  extractor: IHeuristicExtractor<T>,
): Promise<ProcessingOutcome<T>> {
  // ── Step 1: Read ─────────────────────────────────────────────────────────────
  let raw;
  try {
    raw = await readPdf(buffer, fileName);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[PdfProcessingService] Reader failed for "${fileName}": ${msg}`);
    return {
      status: 'FAILED',
      message: `PDF konnte nicht gelesen werden: ${msg}`,
    };
  }

  // ── Step 2: Text quality check ────────────────────────────────────────────────
  const qualityWarning = textQualityWarning(raw.text);
  if (qualityWarning) {
    console.warn(`[PdfProcessingService] "${fileName}": ${qualityWarning}`);
    // We still attempt extraction — a partial result is better than nothing.
  }

  // ── Step 3: Extract ─────────────────────────────────────────────────────────
  let result;
  try {
    result = extractor.extract(raw.text);
  } catch (err) {
    // Extractors must not throw, but we guard defensively.
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[PdfProcessingService] Extractor "${extractor.name}" threw: ${msg}`);
    return {
      status: 'FAILED',
      raw,
      message: `Extraktion fehlgeschlagen: ${msg}`,
    };
  }

  // ── Step 4: Determine status ─────────────────────────────────────────────────
  const allWarnings = [
    ...(qualityWarning ? [qualityWarning] : []),
    ...result.warnings,
  ];

  const status: ProcessingOutcome<T>['status'] =
    result.confidence >= 0.75 ? 'SUCCESS' :
    result.confidence >= 0.25 ? 'PARTIAL'  :
    'FAILED';

  const message =
    status === 'SUCCESS'
      ? `Alle Pflichtfelder erfolgreich extrahiert (${(result.confidence * 100).toFixed(0)} % Konfidenz).`
      : status === 'PARTIAL'
        ? `Teilweise extrahiert (${(result.confidence * 100).toFixed(0)} % Konfidenz) — bitte fehlende Felder manuell ergänzen.`
        : `Extraktion fehlgeschlagen — bitte Daten manuell eingeben.`;

  console.info(
    `[PdfProcessingService] "${fileName}" → ${status} (${(result.confidence * 100).toFixed(0)}%, ` +
    `${extractor.name}, strategy: ${raw.strategy})`,
  );

  return { status, raw, result: { ...result, warnings: allWarnings }, message };
}
