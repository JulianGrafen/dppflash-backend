import type { ExtractionResult } from '../types/dpp-types';
import { spawn } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * PDF Extraction Service – Lokal verarbeitet für DSGVO-Compliance.
 * 
 * Kann auf Python und pdfplumber/pypdf für zuverlässige PDF-Extraktion:
 * - Keine komplexen Browser-APIs erforderlich
 * - Läuft 100% lokal
 * - 100% DSGVO-konform - keine Datentransfers
 * 
 * Fallback auf einfache Textextraktion wenn Python nicht verfügbar
 */

/**
 * Nutze Python mit pdfplumber für kleine PDF-Extraktion.
 * Fallback auf einfache String-Parsing wenn Python nicht verfügbar.
 */
async function extractPdfWithPython(pdfBuffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const tempFile = join(tmpdir(), `temp_${Date.now()}.pdf`);
    
    try {
      // Schreibe PDF zu Temp-Datei
      writeFileSync(tempFile, pdfBuffer);
      
      // Python-Script zum Extrahieren von Text
      const pythonScript = `
import sys
try:
    import pdfplumber
    pdf_path = sys.argv[1]
    with pdfplumber.open(pdf_path) as pdf:
        text = '\\n'.join(page.extract_text() or '' for page in pdf.pages)
        print(text)
except ImportError:
    import PyPDF2
    pdf_path = sys.argv[1]
    with open(pdf_path, 'rb') as f:
        reader = PyPDF2.PdfReader(f)
        text = '\\n'.join(p.extract_text() for p in reader.pages)
        print(text)
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    sys.exit(1)
`;

      const python = spawn('python3', ['-c', pythonScript, tempFile]);
      let output = '';
      let errorOutput = '';

      python.stdout.on('data', (data) => {
        output += data.toString();
      });

      python.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      python.on('close', (code) => {
        unlinkSync(tempFile); // Löschen Temp-Datei

        if (code === 0 && output.trim()) {
          resolve(output.trim());
        } else {
          reject(new Error(errorOutput || 'Python PDF extraction failed'));
        }
      });

      python.on('error', (err) => {
        unlinkSync(tempFile);
        reject(err);
      });
    } catch (error) {
      try {
        unlinkSync(tempFile);
      } catch (e) {
        // Ignore
      }
      reject(error);
    }
  });
}

/**
 * Extrahiert Text direkt aus PDF-Binär (Fallback für wenn Python-Tools nicht verfügbar).
 * Nutzt fortgeschrittene Methoden zur Text-Extrahierung aus PDF-Streams.
 */
function extractPdfWithFallback(buffer: Buffer): string {
  // Strategie 1: UTF-8 Dekodierung
  let text = buffer.toString('utf8', 0, buffer.length);
  let cleaned = text
    .replace(/\x00/g, '') // Null-Bytes entfernen
    .replace(/[^\x20-\x7E\u0080-\u00FF]/g, ' ') // ASCII + Umlaute
    .replace(/\s+/g, ' ')
    .trim();
  
  if (cleaned.length > 100) {
    return cleaned.substring(0, 10000);
  }

  // Strategie 2: Versuche latin1 Dekodierung
  const latin1Text = buffer.toString('latin1');
  
  // Extrahiere alle Strings zwischen Klammern (traditionelle PDF-Struktur)
  const matches: string[] = [];
  const parenPattern = /\(([^()]{3,200})\)/g;
  let match;
  
  while ((match = parenPattern.exec(latin1Text)) !== null) {
    let extracted = match[1]
      .replace(/\\n/g, ' ')
      .replace(/\\/g, '')
      .trim();
    
    // Filter: nur Strings mit echtem Text (nicht PDF-Operatoren)
    if (extracted.length > 2 && 
        !extracted.match(/^\/|^<<|^>>|^[0-9]+\s+[0-9]+|endobj|stream/) &&
        extracted.match(/[a-zA-ZäöüßÄÖÜ0-9]/)) {
      matches.push(extracted);
    }
  }

  if (matches.length > 5) {
    text = matches.join(' ');
    cleaned = text
      .replace(/\s+/g, ' ')
      .slice(0, 10000)
      .trim();
    
    if (cleaned.length > 100) {
      return cleaned;
    }
  }

  // Strategie 3: Brute-Force: Suche nach zusammenhängenden druckbaren Zeichen
  const asciiMatches: string[] = [];
  let current = '';
  
  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];
    // ASCII druckbar (32-126) oder Umlaute
    if ((byte >= 0x20 && byte <= 0x7E) || byte >= 0x80) {
      current += String.fromCharCode(byte);
    } else if (current.length > 3) {
      asciiMatches.push(current);
      current = '';
    }
  }
  
  if (current.length > 3) {
    asciiMatches.push(current);
  }
  
  // Filtere Müll heraus
  const goodStrings = asciiMatches.filter(s => 
    s.length > 3 && 
    s.match(/[a-zA-Z0-9äöüß]/i) &&
    !s.match(/^[\x00-\x1F]{3}/)
  );
  
  if (goodStrings.length > 0) {
    return goodStrings
      .join(' ')
      .replace(/\s+/g, ' ')
      .slice(0, 10000)
      .trim();
  }

  // Fallback: Roh-Text
  return buffer.toString('utf8', 0, Math.min(10000, buffer.length));
}

/**
 * Entfernt PDF-Struktur-Müll (Font-Metadaten, Stream-Tokens etc.) aus extrahiertem Text.
 * Wird nach jeder Extraktionsstrategie angewendet bevor der Text validiert wird.
 */
function cleanPdfText(raw: string): string {
  const JUNK_LINE = [
    /FontDescriptor|FontBBox|ItalicAngle|\/Flags\s+\d/i,
    /BitsPerComponent|ColorSpace|\/Filter\s*\//i,
    /endobj|endstream|startxref/i,
    /^\s*stream\s*$/i,
    /^\s*\d+\s+\d+\s+obj\b/,
    /\/Type\s*\/Font|\/BaseFont|\/Encoding\s*\//i,
    /\/ToUnicode|\/CMapName|\/Registry/i,
    /\/Resources|\/ProcSet|\/XObject/i,
    /^%%EOF/,
    /^\/[A-Z][a-zA-Z]+\s*\//,   // lone /PdfKeyword /
  ];
  return raw
    .split('\n')
    .filter(line => !JUNK_LINE.some(p => p.test(line)))
    .join('\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * Extrahiert Rohtext aus einem PDF-Buffer.
 * Nutzt Python wenn verfügbar, sonst Fallback auf einfache Textextraktion.
 *
 * @param pdfBuffer - Binärer PDF-Inhalt
 * @param fileName - Name des PDFs (für Fehlerbehandlung und Logging)
 * @returns ExtractionResult mit Text und Metadaten
 * @throws Error wenn PDF ungültig oder korrupt ist
 */
export async function extractPdfText(
  pdfBuffer: Buffer,
  fileName: string
): Promise<ExtractionResult> {
  const startTime = Date.now();

  try {
    let textContent = '';

    // Strategie 1: pdf-parse (reines Node.js, funktioniert auf Vercel)
    try {
      const pdfParseModule = await import('pdf-parse');
      const pdfParse = (pdfParseModule as any).default ?? pdfParseModule;
      const parsed = await pdfParse(pdfBuffer);
      if (parsed.text && parsed.text.trim().length > 20) {
        const cleaned = cleanPdfText(parsed.text);
        if (cleaned.length > 20) {
          textContent = cleaned;
          console.log(`📄 PDF mit pdf-parse extrahiert (bereinigt): ${textContent.length} Zeichen`);
        }
      }
    } catch (e) {
      console.log(`⚠️ pdf-parse fehlgeschlagen: ${e}`);
    }

    // Strategie 2: Python (optional, nur lokal verfügbar)
    if (!textContent) {
      try {
        const raw = await extractPdfWithPython(pdfBuffer);
        textContent = cleanPdfText(raw);
        console.log(`📄 PDF mit Python extrahiert (bereinigt): ${textContent.length} Zeichen`);
      } catch (e) {
        console.log(`⚠️ Python nicht verfügbar, nutze Binär-Fallback`);
      }
    }

    // Strategie 3: Binär-Fallback (letzter Ausweg)
    if (!textContent) {
      textContent = cleanPdfText(extractPdfWithFallback(pdfBuffer));
      console.log(`📄 PDF mit Binär-Fallback extrahiert (bereinigt): ${textContent.length} Zeichen`);
    }

    const extractionDuration = Date.now() - startTime;

    if (!textContent || textContent.trim().length === 0) {
      throw new Error(`PDF "${fileName}" enthält keinen extrahierbaren Text`);
    }

    console.log(`📄 PDF "${fileName}" extrahiert: ${textContent.length} Zeichen`);

    return {
      text: textContent,
      pageCount: 1,
      metadata: {
        fileName: fileName,
      },
      extractionDuration,
    };
  } catch (error) {
    throw new Error(
      `PDF-Extraktion fehlgeschlagen für "${fileName}": ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
    );
  }
}

/**
 * Validiert, ob die extrahierten Rohdaten sinnvoll wirken.
 * Heuristik: Mindestanzahl Zeichen + Sonderzeichen-Ratio
 * 
 * @param text - Rohtext aus PDF
 * @returns true wenn Text plausibel ist
 */
export function isValidExtractionText(text: string): boolean {
  // Minimale Textlänge für sinnvolle Extraktion
  const MIN_CHARS = 20;
  // Maximal akzeptierter Anteil von Sonderzeichen
  const GARBAGE_RATIO = 0.6;

  console.log(`📋 Validierungstext-Länge: ${text.length} Zeichen (mindestens ${MIN_CHARS} erforderlich)`);

  if (text.length < MIN_CHARS) {
    console.log('❌ Text zu kurz - überspringe Validierung');
    return false;
  }

  // Zähle Sonderzeichen (außer Deutsch-Umlauten und normalen Zeichen)
  const specialCharCount = (text.match(/[^a-zA-Z0-9äöüßÄÖÜ\s\-.,;:()\n%€$\/\[\]'"!?@#*+]/g) || []).length;
  const ratio = specialCharCount / text.length;

  // Erkenne PDF-Binär-Müll (Font-Metadaten usw.)
  const hasFontGarbage = /FontDescriptor|FontBBox|ItalicAngle|\/Flags\s+\d|BitsPerComponent|ColorSpace/i.test(text);
  if (hasFontGarbage) {
    console.log('❌ Text enthält PDF-Binär-Müll (Font Descriptor)');
    return false;
  }

  console.log(`📊 Sonderzeichen-Ratio: ${(ratio * 100).toFixed(1)}% (max ${(GARBAGE_RATIO * 100).toFixed(1)}%)`);

  return ratio < GARBAGE_RATIO;
}
