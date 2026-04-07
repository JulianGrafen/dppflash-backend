import type { ExtractionResult } from '../types/dpp-types';

/**
 * PDF Extraction Service — pdfjs-dist primary, pdf-parse fallback, raw binary last resort.
 * Works on Vercel (serverless) and locally without any native dependencies.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Strategy 1 — pdfjs-dist (Mozilla PDF.js, pure JS, most reliable)
// ─────────────────────────────────────────────────────────────────────────────
async function extractWithPdfjs(pdfBuffer: Buffer): Promise<string> {
  // Must use legacy build in Node.js (no DOMMatrix dependency)
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs') as any;

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(pdfBuffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
    disableFontFace: true,
    verbosity: 0, // silence warnings
  });

  const pdf = await loadingTask.promise;
  const parts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str ?? '')
      .join(' ');
    parts.push(pageText);
  }

  return parts.join('\n').replace(/[ \t]{2,}/g, ' ').trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Strategy 2 — pdf-parse v2 (PDFParse class API)
// ─────────────────────────────────────────────────────────────────────────────
async function extractWithPdfParse(pdfBuffer: Buffer): Promise<string> {
  const { PDFParse } = await import('pdf-parse') as any;
  const parser = new PDFParse({ data: pdfBuffer });
  const result = await parser.getText();
  const text: string = result?.text ?? '';
  return text.replace(/[ \t]{2,}/g, ' ').trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Strategy 3 — Raw binary scan (last resort for non-standard PDFs)
// Walks the buffer extracting printable ASCII runs from content streams.
// ─────────────────────────────────────────────────────────────────────────────
function extractWithBinaryScan(buffer: Buffer): string {
  const latin1 = buffer.toString('latin1');
  const runs: string[] = [];

  // Walk stream ... endstream blocks — those contain the actual text operators
  const streamRe = /stream\r?\n([\s\S]*?)\nendstream/g;
  let m: RegExpExecArray | null;
  while ((m = streamRe.exec(latin1)) !== null) {
    const block = m[1];
    // PDF text in parentheses: (Hello World)
    const parenRe = /\(([^()]{1,300})\)/g;
    let pm: RegExpExecArray | null;
    while ((pm = parenRe.exec(block)) !== null) {
      const s = pm[1]
        .replace(/\\n/g, ' ')
        .replace(/\\r/g, '')
        .replace(/\\\\/g, '\\')
        .replace(/\\([0-9]{1,3})/g, (_: string, oct: string) =>
          String.fromCharCode(parseInt(oct, 8))
        )
        .trim();
      if (s.length > 1 && /[a-zA-Z0-9äöüßÄÖÜ]/.test(s)) {
        runs.push(s);
      }
    }
  }

  if (runs.length > 3) {
    return runs.join(' ').replace(/\s{2,}/g, ' ').trim();
  }

  // Absolute last resort: extract long printable ASCII sequences from entire buffer
  const printable: string[] = [];
  let current = '';
  for (let i = 0; i < Math.min(buffer.length, 200_000); i++) {
    const b = buffer[i];
    if (b >= 0x20 && b <= 0x7e) {
      current += String.fromCharCode(b);
    } else {
      if (current.length >= 4 && /[a-zA-Z0-9]/.test(current)) {
        printable.push(current);
      }
      current = '';
    }
  }
  if (current.length >= 4) printable.push(current);

  return printable
    .filter(s => !/^(endobj|endstream|startxref|stream|xref|trailer)$/.test(s.trim()))
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .slice(0, 15_000)
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────
export async function extractPdfText(
  pdfBuffer: Buffer,
  fileName: string
): Promise<ExtractionResult> {
  const startTime = Date.now();
  let textContent = '';
  let pageCount = 1;
  let strategy = '';

  // 1. pdfjs-dist — most reliable, handles all conforming PDFs
  if (!textContent) {
    try {
      textContent = await extractWithPdfjs(pdfBuffer);
      strategy = 'pdfjs-dist';
    } catch (e) {
      console.log(`⚠️  pdfjs-dist: ${e instanceof Error ? e.message : e}`);
    }
  }

  // 2. pdf-parse v2 — good fallback
  if (!textContent) {
    try {
      textContent = await extractWithPdfParse(pdfBuffer);
      strategy = 'pdf-parse';
    } catch (e) {
      console.log(`⚠️  pdf-parse: ${e instanceof Error ? e.message : e}`);
    }
  }

  // 3. Raw binary scan — catches non-standard / hand-crafted PDFs
  if (!textContent) {
    textContent = extractWithBinaryScan(pdfBuffer);
    strategy = 'binary-scan';
  }

  const extractionDuration = Date.now() - startTime;

  if (!textContent || textContent.trim().length < 5) {
    throw new Error(
      `PDF "${fileName}" enthält keinen extrahierbaren Text (alle 3 Strategien fehlgeschlagen)`
    );
  }

  console.log(`📄 "${fileName}" → ${strategy}, ${textContent.length} Zeichen, ${extractionDuration}ms`);

  return {
    text: textContent,
    pageCount,
    metadata: { fileName },
    extractionDuration,
  };
}

export function isValidExtractionText(text: string): boolean {
  if (text.length < 20) return false;
  const garbage = (text.match(/[^a-zA-Z0-9äöüßÄÖÜ\s\-.,;:()\n%€$\/\[\]'"!?@#*+]/g) ?? []).length;
  return garbage / text.length < 0.6;
}
