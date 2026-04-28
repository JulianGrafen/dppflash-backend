/**
 * PdfReader
 *
 * Converts a raw PDF Buffer into normalised plain text.
 * Three strategies are tried in order of reliability:
 *
 *   1. pdfjs-dist/legacy  — Mozilla PDF.js; handles all conforming PDFs,
 *                           works in Node.js without native bindings.
 *   2. pdf-parse v2       — PDFParse class API (breaking change from v1).
 *   3. Binary stream scan — Last resort; extracts parenthesised strings
 *                           directly from raw PDF content streams.
 *
 * GDPR note: every byte stays in process — no network calls are made.
 */

import type { RawPdfContent } from '../types/extraction';

type PdfJsGetDocumentInput = Parameters<typeof import('pdfjs-dist').getDocument>[0];

interface PdfParseTextResult {
  readonly text?: string;
}

interface PdfParseInstance {
  getText(): Promise<PdfParseTextResult>;
}

interface PdfParseConstructor {
  new(input: { readonly data: Buffer }): PdfParseInstance;
}

// ─── Quality gate ─────────────────────────────────────────────────────────────

/**
 * Returns true when the string is probably binary garbage rather than real text.
 *
 * PDFs with embedded CIDFonts expose binary glyph IDs as Latin-1 characters in
 * the range U+0080–U+00FF.  We tolerate German umlauts (Ä Ö Ü ä ö ü ß) and
 * the Euro sign, but anything else in that range signals a bad decode.
 *
 * Threshold: > 10 % "suspicious extended" chars flagged → garbage.
 */
const GERMAN_EXTENDED = new Set([0xc4, 0xd6, 0xdc, 0xe4, 0xf6, 0xfc, 0xdf, 0x20ac]);

function looksLikeBinary(text: string): boolean {
  if (text.length < 20) return false;
  let suspicious = 0;
  for (let i = 0; i < text.length; i++) {
    const cp = text.codePointAt(i) ?? 0;
    if (cp > 0x7f && !GERMAN_EXTENDED.has(cp)) suspicious++;
  }
  return suspicious / text.length > 0.10;
}

// ─── Junk-line filter ─────────────────────────────────────────────────────────

/** PDF structural tokens that leak through text extraction and must be removed. */
const JUNK_PATTERNS: RegExp[] = [
  /FontDescriptor|FontBBox|ItalicAngle|\/Flags\s+\d/i,
  /BitsPerComponent|ColorSpace|\/Filter\s*\//i,
  /endobj|endstream|startxref/i,
  /^\s*stream\s*$/,
  /^\s*\d+\s+\d+\s+obj\b/,
  /\/Type\s*\/Font|\/BaseFont|\/Encoding\s*\//i,
  /\/ToUnicode|\/CMapName|\/Registry/i,
  /\/Resources|\/ProcSet|\/XObject/i,
  /^%%EOF/,
  /^\/[A-Z][a-zA-Z]+\s*\//,
];

function stripJunk(raw: string): string {
  return raw
    .split('\n')
    .filter((line) => !JUNK_PATTERNS.some((p) => p.test(line)))
    .join('\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

// ─── Strategy 1: pdfjs-dist (Mozilla PDF.js, legacy Node.js build) ────────────

async function readWithPdfjs(buffer: Buffer): Promise<string> {
  // The legacy build avoids the `DOMMatrix is not defined` error in Node.js.
  const pdfjsLib = (await import(
    'pdfjs-dist/legacy/build/pdf.mjs'
  )) as typeof import('pdfjs-dist');

  const documentParameters = {
    data: new Uint8Array(buffer),
    disableWorker: true,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
    disableFontFace: true,
    verbosity: 0,
  } as unknown as PdfJsGetDocumentInput;

  const loadingTask = pdfjsLib.getDocument(documentParameters);

  const pdf = await loadingTask.promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(
      content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' '),
    );
  }

  return pages.join('\n');
}

// ─── Strategy 2: pdf-parse v2 (PDFParse class) ────────────────────────────────

async function readWithPdfParse(buffer: Buffer): Promise<string> {
  // pdf-parse v2 changed the API: it exports a named class, not a function.
  const { PDFParse } = (await import('pdf-parse')) as { PDFParse: PdfParseConstructor };
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return result.text ?? '';
}

// ─── Strategy 3: Binary content-stream scan ───────────────────────────────────

/**
 * Walks the raw latin-1 representation of the PDF, extracts text objects
 * between `stream … endstream` markers, and decodes parenthesised strings:
 * e.g.  `(Hersteller: Tesla)`  →  `Hersteller: Tesla`
 *
 * Handles basic PDF escape sequences: \n \r \\ \OOO (octal).
 */
function readWithBinaryScan(buffer: Buffer): string {
  const latin1 = buffer.toString('latin1');
  const runs: string[] = [];

  const streamBlock = /stream\r?\n([\s\S]*?)\nendstream/g;
  let sm: RegExpExecArray | null;

  while ((sm = streamBlock.exec(latin1)) !== null) {
    const parenString = /\(([^()]{1,300})\)/g;
    let pm: RegExpExecArray | null;

    while ((pm = parenString.exec(sm[1])) !== null) {
      const decoded = pm[1]
        .replace(/\\n/g, ' ')
        .replace(/\\r/g, '')
        .replace(/\\\\/g, '\\')
        .replace(/\\(\d{1,3})/g, (_, oct) =>
          String.fromCharCode(parseInt(oct, 8)),
        )
        .trim();

      if (decoded.length > 1 && /[a-zA-Z0-9äöüßÄÖÜ]/.test(decoded)) {
        runs.push(decoded);
      }
    }
  }

  // Absolute last resort: long printable ASCII runs from the whole buffer.
  if (runs.length < 4) {
    let current = '';
    const limit = Math.min(buffer.length, 200_000);

    for (let i = 0; i < limit; i++) {
      const b = buffer[i];
      if (b >= 0x20 && b <= 0x7e) {
        current += String.fromCharCode(b);
      } else {
        if (current.length >= 4 && /[a-zA-Z0-9]/.test(current)) {
          runs.push(current);
        }
        current = '';
      }
    }
  }

  return runs
    .filter(
      (s) =>
        !/^(endobj|endstream|startxref|stream|xref|trailer)$/.test(s.trim()),
    )
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .slice(0, 15_000);
}

// ─── Public API ───────────────────────────────────────────────────────────────

const MIN_USABLE_LENGTH = 10;

/**
 * Convert a PDF buffer to normalised plain text.
 *
 * @param buffer   Raw bytes of the PDF file.
 * @param fileName Used only for error messages and audit metadata.
 * @returns        `RawPdfContent` describing the extracted text and its origin.
 * @throws         Only when all three strategies fail to produce any text.
 */
export async function readPdf(
  buffer: Buffer,
  fileName: string,
): Promise<RawPdfContent> {
  const start = Date.now();

  type StrategyResult = { text: string; strategy: RawPdfContent['strategy'] };

  const strategies: Array<{
    name: RawPdfContent['strategy'];
    run: () => Promise<string> | string;
  }> = [
    { name: 'pdfjs', run: () => readWithPdfjs(buffer) },
    { name: 'pdf-parse', run: () => readWithPdfParse(buffer) },
    { name: 'binary-scan', run: () => readWithBinaryScan(buffer) },
  ];

  let outcome: StrategyResult | undefined;

  for (const { name, run } of strategies) {
    try {
      const raw = await run();
      const text = stripJunk(raw);
      if (text.length < MIN_USABLE_LENGTH) {
        console.debug(`[PdfReader] ${name}: ${text.length} chars — too short, trying next`);
        continue;
      }
      if (looksLikeBinary(text)) {
        console.warn(`[PdfReader] ${name}: output looks like binary garbage (high extended-char ratio), skipping`);
        continue;
      }
      outcome = { text, strategy: name };
      break;
    } catch (err) {
      console.warn(
        `[PdfReader] ${name} failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  if (!outcome) {
    throw new Error(
      `[PdfReader] "${fileName}": all three extraction strategies produced no usable text.`,
    );
  }

  const pageCount = await getPageCount(buffer, outcome.strategy).catch(() => 1);

  console.info(
    `[PdfReader] "${fileName}" → ${outcome.strategy}, ${outcome.text.length} chars, ${Date.now() - start}ms`,
  );

  return {
    text: outcome.text,
    pageCount,
    fileName,
    strategy: outcome.strategy,
    extractedAt: new Date().toISOString(),
    durationMs: Date.now() - start,
  };
}

/** Best-effort page-count: only pdfjs gives us a reliable number. */
async function getPageCount(
  buffer: Buffer,
  strategy: RawPdfContent['strategy'],
): Promise<number> {
  if (strategy !== 'pdfjs') return 1;
  const pdfjsLib = (await import(
    'pdfjs-dist/legacy/build/pdf.mjs'
  )) as typeof import('pdfjs-dist');
  const pdf = await pdfjsLib
    .getDocument({
      data: new Uint8Array(buffer),
      disableWorker: true,
      verbosity: 0,
    } as unknown as PdfJsGetDocumentInput)
    .promise;
  return pdf.numPages;
}
