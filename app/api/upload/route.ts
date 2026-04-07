import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

// ─── Types ───────────────────────────────────────────────────────────────────

interface BatteryPassport {
  id: string;
  type: 'BATTERY';
  hersteller: string;
  modellname: string;
  herstellungsdatum: string;
  kapazitaetKWh: number;
  chemischesSystem: string;
  co2Fussabdruck: string;
  recyclingAnteilLi: number;
  recyclingAnteilCo: number;
  erwarteteLebensdauer: string;
}

// ─── Extraction helpers ───────────────────────────────────────────────────────

/** Extract a plain string value for a given label */
function extractString(text: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return '';
}

/** Extract a float value for a given label */
function extractNumber(text: string, patterns: RegExp[]): number {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const value = parseFloat(match[1].replace(',', '.'));
      if (!isNaN(value)) return value;
    }
  }
  return 0;
}

/** Parse all ESPR-required battery fields from raw PDF text */
function extractBatteryFields(text: string): Omit<BatteryPassport, 'id' | 'type'> {
  const hersteller = extractString(text, [
    /(?:hersteller|manufacturer|produzent|company)[:\s]+([^\n,;]{2,60})/i,
    /\b([A-Z][a-zA-Z0-9\s&\-]{2,40}(?:GmbH|AG|Inc|Ltd|SE|KG))\b/,
  ]);

  const modellname = extractString(text, [
    /(?:modell(?:name|bezeichnung)?|model(?:\s*name)?)[:\s]+([^\n,;]{2,60})/i,
    /(?:produkt|product)[:\s]+([^\n,;]{2,60})/i,
  ]);

  const herstellungsdatum = extractString(text, [
    /(?:herstellungs|produktions)datum[:\s]+([^\n,;]{4,20})/i,
    /(?:manufactured|production\s*date)[:\s]+([^\n,;]{4,20})/i,
    /(?:datum|date)[:\s]+(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i,
  ]);

  const kapazitaetKWh = extractNumber(text, [
    /(\d+(?:[.,]\d+)?)\s*kWh/i,
    /(?:kapazit[äa]t|capacity)[:\s]+(\d+(?:[.,]\d+)?)/i,
  ]);

  const chemischesSystem = extractString(text, [
    /(?:chemisches?\s*system|chemistry|zellchemie)[:\s]+([^\n,;]{2,50})/i,
    /(?:batterietyp|battery\s*type)[:\s]+([^\n,;]{2,50})/i,
    /(LiFePO4|NMC|NCA|LCO|LFP|Lithium-Ionen[^\n,;]{0,30}|Blei-Säure|NiMH)/i,
  ]);

  const co2Fussabdruck = extractString(text, [
    /(?:co2[- ]?fu[sß]{1,2}abdruck|carbon\s*footprint|co2)[:\s]+([^\n,;]{2,50})/i,
    /(\d+(?:[.,]\d+)?\s*kg\s*co2[^\n,;]{0,20})/i,
  ]);

  const recyclingAnteilLi = extractNumber(text, [
    /(?:lithium|li)[^\n]{0,20}(?:recycling[^\n]{0,10})?(\d+(?:[.,]\d+)?)\s*%/i,
    /recycling[^\n]{0,30}lithium[^\n]{0,10}(\d+(?:[.,]\d+)?)\s*%/i,
  ]);

  const recyclingAnteilCo = extractNumber(text, [
    /(?:kobalt|cobalt|co)[^\n]{0,20}(?:recycling[^\n]{0,10})?(\d+(?:[.,]\d+)?)\s*%/i,
    /recycling[^\n]{0,30}(?:kobalt|cobalt)[^\n]{0,10}(\d+(?:[.,]\d+)?)\s*%/i,
  ]);

  const erwarteteLebensdauer = extractString(text, [
    /(?:lebensdauer|lifespan|lifecycle|ladezyklen|cycles)[:\s]+([^\n,;]{2,50})/i,
    /(\d[\d.,\s]*(?:lade)?zyklen)/i,
    /(\d[\d.,\s]*\s*Jahre)/i,
  ]);

  return {
    hersteller,
    modellname,
    herstellungsdatum,
    kapazitaetKWh,
    chemischesSystem,
    co2Fussabdruck,
    recyclingAnteilLi,
    recyclingAnteilCo,
    erwarteteLebensdauer,
  };
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { success: false, error: "Keine Datei unter dem Key 'file' gefunden." },
        { status: 400 }
      );
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { success: false, error: `Ungültiger Typ: ${file.type}. Nur PDF erlaubt.` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Extract text with pdf-parse (pure Node.js — no binaries, works on Vercel)
    const pdfParseModule = await import('pdf-parse');
    const pdfParse = (pdfParseModule as any).default ?? pdfParseModule;
    const parsed = await pdfParse(buffer);
    const text: string = parsed.text ?? '';

    if (!text.trim()) {
      return NextResponse.json(
        { success: false, error: 'PDF enthält keinen lesbaren Text (möglicherweise gescannt).' },
        { status: 422 }
      );
    }

    const fields = extractBatteryFields(text);

    const data: BatteryPassport = {
      id: randomUUID(),
      type: 'BATTERY',
      ...fields,
    };

    return NextResponse.json({ success: true, data });

  } catch (error) {
    console.error('Upload route error:', error);
    return NextResponse.json(
      { success: false, error: 'Interner Fehler beim Verarbeiten der PDF.' },
      { status: 500 }
    );
  }
}
