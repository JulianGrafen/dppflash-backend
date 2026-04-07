/**
 * pdfExtractionService
 *
 * Thin shim that adapts the new PdfReader (utils/pdfReader.ts) to the legacy
 * `ExtractionResult` interface consumed by documentProcessingService.ts.
 *
 * All extraction logic now lives in:
 *   utils/pdfReader.ts                 — PDF → raw text (3 strategies)
 *   services/extractor/HeuristicExtractor.ts  — raw text → typed fields
 *   services/PdfProcessingService.ts   — orchestration
 */

import type { ExtractionResult } from '../types/dpp-types';
import { readPdf } from '../utils/pdfReader';

export async function extractPdfText(
  pdfBuffer: Buffer,
  fileName: string,
): Promise<ExtractionResult> {
  const raw = await readPdf(pdfBuffer, fileName);
  return {
    text: raw.text,
    pageCount: raw.pageCount,
    metadata: { fileName },
    extractionDuration: raw.durationMs,
  };
}

export function isValidExtractionText(text: string): boolean {
  if (text.length < 20) return false;
  const garbage = (
    text.match(/[^a-zA-Z0-9äöüßÄÖÜ\s\-.,;:()\n%€$\/\[\]'"!?@#*+]/g) ?? []
  ).length;
  return garbage / text.length < 0.6;
}

