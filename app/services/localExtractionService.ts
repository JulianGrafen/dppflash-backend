/**
 * Local PDF Extraction Service
 *
 * Architecture:
 *   IExtractor  — contract; swap strategy without touching call sites
 *   BatteryRegexExtractor — ESPR-aligned regex + heuristic implementation
 *   extractorRegistry — runtime-swappable map (DI-lite)
 *   extractFromPdfBuffer — single public entry point
 *
 * Extraction never throws; missing fields produce warnings instead.
 */

import { randomUUID } from 'crypto';
import type {
  EsprProductData,
  ProductCategory,
  Manufacturer,
  CarbonFootprint,
  RecycledContent,
  Lifecycle,
  EndOfLife,
} from '../types/espr';

// ─── Public contract ──────────────────────────────────────────────────────────

export interface IExtractor {
  readonly productType: ProductCategory;
  /**
   * Map cleaned PDF text to partial ESPR data.
   * Must never throw — return empty objects for fields that cannot be found.
   */
  extract(
    text: string,
  ): Omit<
    EsprProductData,
    'id' | 'createdAt' | 'language' | 'type' | 'extractionConfidence' | 'extractionWarnings'
  >;
}

// ─── Text cleaning ────────────────────────────────────────────────────────────

const PDF_JUNK_PATTERNS: RegExp[] = [
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

function cleanText(raw: string): string {
  return raw
    .split('\n')
    .filter((line) => !PDF_JUNK_PATTERNS.some((p) => p.test(line)))
    .join('\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

// ─── Shared extraction primitives ────────────────────────────────────────────

/**
 * Return first capture group that matches and has a plausible length.
 * Returns '' when nothing matches.
 */
function matchStr(text: string, patterns: RegExp[], maxLen = 120): string {
  for (const re of patterns) {
    const value = text.match(re)?.[1]?.trim() ?? '';
    if (value.length > 1 && value.length <= maxLen) return value;
  }
  return '';
}

/** Parse German ("1.234,56") and English ("1,234.56") number strings to float. */
function parseNum(raw: string): number {
  const s = raw.trim();
  // German thousands-only: "1.234" → 1234
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return parseFloat(s.replace(/\./g, ''));
  // English thousands-only: "1,000" → 1000
  if (/^\d{1,3}(,\d{3})+$/.test(s)) return parseFloat(s.replace(/,/g, ''));
  // German decimal: "1,5" → 1.5
  if (s.includes(',') && !s.includes('.')) return parseFloat(s.replace(',', '.'));
  // Both separators: "1.234,56" → 1234.56
  if (s.includes('.') && s.includes(','))
    return parseFloat(s.replace(/\./g, '').replace(',', '.'));
  return parseFloat(s);
}

/** Return first numeric match within optional bounds; undefined when missing. */
function matchNum(
  text: string,
  patterns: RegExp[],
  min?: number,
  max?: number,
): number | undefined {
  for (const re of patterns) {
    const raw = text.match(re)?.[1];
    if (!raw) continue;
    const v = parseNum(raw);
    if (isNaN(v)) continue;
    if (min !== undefined && v < min) continue;
    if (max !== undefined && v > max) continue;
    return v;
  }
  return undefined;
}

/** Convenience wrapper for percentages (0–100). */
const matchPct = (text: string, patterns: RegExp[]) =>
  matchNum(text, patterns, 0, 100);

// ─── Battery extractor ────────────────────────────────────────────────────────

export class BatteryRegexExtractor implements IExtractor {
  readonly productType: ProductCategory = 'BATTERY';

  extract(text: string) {
    return {
      manufacturer: this.extractManufacturer(text),
      hersteller: this.extractManufacturer(text).name,
      model: this.extractModel(text),
      modellname: this.extractModel(text),

      serialNumber:
        matchStr(text, [
          /(?:seriennummer|serial\s*(?:number|no\.?)|s\/n)[\s:]+([^\s,;\n]{3,50})/i,
        ]) || undefined,

      batchNumber:
        matchStr(text, [
          /(?:chargennummer|batch(?:\s*number)?|lot(?:\s*number)?)[\s:]+([^\s,;\n]{3,50})/i,
        ]) || undefined,

      productionDate: this.extractProductionDate(text),

      capacityKwh: matchNum(
        text,
        [
          /(\d[\d.,]*)\s*kwh/i,
          /(?:kapazität|nennkapazität|capacity|rated\s*capacity)[\s:]+(\d[\d.,]*)/i,
        ],
        0.01,
        100_000,
      ),

      chemistry: this.extractChemistry(text),

      batteryType:
        matchStr(text, [
          /(?:batterietyp|battery\s*type|typ)[\s:]+([^\n,;]{3,50})/i,
          /(stationär|stationary|industrial|industriell|\bEV\b|Elektrofahrzeug)/i,
        ]) || undefined,

      nominalVoltageV: matchNum(
        text,
        [
          /(?:nennspannung|nominal\s*voltage)[\s:]+(\d[\d.,]*)\s*v/i,
          /(\d[\d.,]*)\s*v(?:olt)?(?:\s|,|;|$)/i,
        ],
        1,
        100_000,
      ),

      weightKg: matchNum(
        text,
        [
          /(?:gewicht|weight|masse)[\s:]+(\d[\d.,]*)\s*kg/i,
          /(\d[\d.,]*)\s*kg(?:\s|,|;|$)/i,
        ],
        0.001,
        100_000,
      ),

      carbonFootprint: this.extractCarbonFootprint(text),
      recycledContent: this.extractRecycledContent(text),
      lifecycle: this.extractLifecycle(text),
      endOfLife: this.extractEndOfLife(text),

      certificationBody:
        matchStr(text, [
          /(?:zertifizierungsstelle|certification\s*body|zertifiziert\s*von)[\s:]+([^\n,;]{3,80})/i,
          /(TÜV[^\n,;]{0,40}|DEKRA[^\n,;]{0,30}|Bureau\s*Veritas[^\n,;]{0,30}|SGS[^\n,;]{0,30}|Intertek[^\n,;]{0,30})/i,
        ]) || undefined,

      regulatoryReference:
        matchStr(text, [
          /(?:eu|regulation|verordnung)[\s:/]+(\d{4}\/\d{1,5})/i,
          /(EU\s*(?:Battery\s*Regulation|Batterieverordnung)[^\n,;]{0,50})/i,
        ]) || undefined,

      legalNotes:
        matchStr(
          text,
          [
            /(?:rechtliche\s*hinweise?|legal\s*notes?)[\s:]+([^\n]{10,300})/i,
          ],
          300,
        ) || undefined,

      supplyChainInfo:
        matchStr(text, [
          /(?:lieferkette|supply\s*chain|herkunft)[\s:]+([^\n,;]{5,200})/i,
        ]) || undefined,
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private extractManufacturer(text: string): Manufacturer {
    // Strategy 1: explicit label  (most reliable)
    let name = matchStr(text, [
      /(?:hersteller|manufacturer|maker|produzent|producer)[\s:]+(.+?)(?=\n|,|;|$)/i,
      /(?:unternehmen|company|firma)[\s:]+(.+?)(?=\n|,|;|$)/i,
    ]);

    // Strategy 2: known battery-industry brand list
    if (!name) {
      const BRANDS = [
        'Tesla', 'Panasonic', 'Samsung SDI', 'LG Chem', 'CATL', 'BYD',
        'Volkswagen', 'BMW', 'Mercedes-Benz', 'Audi', 'Porsche', 'Hyundai', 'Kia',
        'Siemens', 'Bosch', 'ABB', 'Eaton', 'TechVolt', 'PowerCell',
      ];
      const lower = text.toLowerCase();
      name = BRANDS.find((b) => lower.includes(b.toLowerCase())) ?? '';
    }

    // Strategy 3: "Company Name GmbH / AG / Inc." pattern
    if (!name) {
      name =
        text.match(
          /\b([A-Z][a-zA-Z0-9 &\-]{2,50}(?:GmbH|AG|Inc\.?|Ltd\.?|SE|KG|SA|BV))\b/,
        )?.[1]?.trim() ?? '';
    }

    // Strategy 4: first meaningful non-keyword line of the document
    if (!name) {
      name = this.firstMeaningfulLine(text, 0);
    }

    const country =
      matchStr(text, [
        /(?:herkunftsland|land|country)[\s:]+([A-Z]{2})\b/i,
        /(?:made\s*in|hergestellt\s*in)\s+([a-zA-Z]{2,30})/i,
      ]) || undefined;

    const address =
      matchStr(text, [/(?:adresse|address|anschrift)[\s:]+([^\n]{5,100})/i]) ||
      undefined;

    return { name, country, address };
  }

  private extractModel(text: string): string {
    // Strategy 1: explicit label
    const labeled = matchStr(text, [
      /(?:modellname|produktname|product\s*name|model(?:\s*name)?)[\s:]+([^\n,;]{2,80})/i,
      /(?:produktbezeichnung|product\s*description)[\s:]+([^\n,;]{2,80})/i,
    ]);
    if (labeled) return labeled;

    // Strategy 2: known model designators
    const designators = [
      /\b(Model\s+[3SXY])\b/i,
      /\b(ID\.\s*\d)\b/i,
      /\b([A-Z][a-zA-Z0-9 \-]{3,40}(?:Pro|Plus|Max|Standard|GT|XL|SE)\s*[\dT]*)\b/i,
    ];
    for (const p of designators) {
      const m = text.match(p)?.[0]?.trim();
      if (m) return m;
    }

    // Strategy 3: second meaningful non-keyword line (likely product name on cover)
    return this.firstMeaningfulLine(text, 1);
  }

  private extractChemistry(text: string): string | undefined {
    const CHEMISTRIES: Array<[RegExp, string]> = [
      [/\bLiFePO4\b|\bLFP\b/i,                   'LiFePO4 (LFP)'],
      [/\bNMC\b|\bNCM\b|\bnickel.mangan.cobalt/i, 'NMC'],
      [/\bNCA\b|\bnickel.cobalt.aluminum/i,        'NCA'],
      [/\bLCO\b|\blithium.cobalt.oxide/i,          'LCO'],
      [/\bNiMH\b|\bnickel.metal.hydrid/i,          'NiMH'],
      [/\bblei.säure|\blead.acid/i,                'Blei-Säure'],
      [/\bnatrium.ion|\bsodium.ion/i,              'Natrium-Ionen'],
      [/\bfest.elektrolyt|\bsolid.state/i,         'Fest-Elektrolyt'],
      [/\bli.ion|\blithium.ion/i,                  'Lithium-Ionen'],
    ];
    for (const [re, label] of CHEMISTRIES) {
      if (re.test(text)) return label;
    }
    return (
      matchStr(text, [
        /(?:chemisches?\s*system|chemistry|zellchemie)[\s:]+([^\n,;]{3,60})/i,
      ]) || undefined
    );
  }

  private extractCarbonFootprint(text: string): CarbonFootprint {
    return {
      totalKg: matchNum(
        text,
        [
          /co2[\w\s\-]*(?:fußabdruck|footprint|fussabdruck)[\s:]+(\d[\d.,]*)\s*(?:kg|t)/i,
          /(\d[\d.,]+)\s*kg\s*co2e(?!\s*\/)/i,
          /(\d[\d.,]+)\s*kg\s*co2(?!\s*e?\s*\/)/i,
        ],
        0,
        10_000_000,
      ),
      perKwhKg: matchNum(
        text,
        [
          /(\d[\d.,]*)\s*(?:kg\s*)?co2(?:e)?\s*(?:pro|per|\/)\s*kwh/i,
          /co2[\w\s\-]*(?:pro|per|\/)\s*kwh[\s:]+(\d[\d.,]*)/i,
        ],
        0,
        100_000,
      ),
      methodology:
        matchStr(text, [
          /(ISO\s*\d{4,5}(?::\d{4})?)/i,
          /(IEC\s*\d{4,5}(?::\d{4})?)/i,
          /(?:methodik|methodology)[\s:]+([^\n,;]{5,80})/i,
        ]) || undefined,
    };
  }

  private extractRecycledContent(text: string): RecycledContent {
    return {
      cobaltPct: matchPct(text, [
        /(?:kobalt|cobalt)[^\n]{0,50}?(\d{1,3}(?:[.,]\d+)?)\s*%/i,
        /recycling[^\n]{0,40}?(?:kobalt|cobalt)[^\n]{0,30}?(\d{1,3}(?:[.,]\d+)?)\s*%/i,
      ]),
      lithiumPct: matchPct(text, [
        /(?:lithium)[^\n]{0,50}?(\d{1,3}(?:[.,]\d+)?)\s*%/i,
        /recycling[^\n]{0,40}?lithium[^\n]{0,30}?(\d{1,3}(?:[.,]\d+)?)\s*%/i,
      ]),
      nickelPct: matchPct(text, [
        /(?:nickel)[^\n]{0,50}?(\d{1,3}(?:[.,]\d+)?)\s*%/i,
        /recycling[^\n]{0,40}?nickel[^\n]{0,30}?(\d{1,3}(?:[.,]\d+)?)\s*%/i,
      ]),
      leadPct: matchPct(text, [
        /(?:blei|lead|pb)[^\n]{0,50}?(\d{1,3}(?:[.,]\d+)?)\s*%/i,
      ]),
    };
  }

  private extractLifecycle(text: string): Lifecycle {
    return {
      expectedCycles: matchNum(
        text,
        [
          /(?:lebensdauer|lifespan|lifecycle|ladezyklen|cycles)[\s:]+(\d[\d.,]*)/i,
          /(?:bis\s*zu|up\s*to|~)\s*(\d[\d.,]*)\s*(?:lade)?zyklen/i,
          /(\d[\d.,]*)\s*(?:lade)?zyklus(?:se)?/i,
          /(\d{3,5})\s*(?:full\s*)?(?:charge\s*)?cycles/i,
        ],
        100,
        100_000,
      ),
      repairabilityScore: matchNum(
        text,
        [
          /(?:reparierbarkeit|repairability)(?:[^\n]{0,20})[\s:]+(\d+(?:[.,]\d+)?)\s*(?:\/\s*10)?/i,
          /reparierbarkeitsindex[\s:]+(\d+(?:[.,]\d+)?)/i,
          /repair[^\n]{0,20}score[\s:]+(\d+(?:[.,]\d+)?)/i,
        ],
        0,
        10,
      ),
      sparePartsAvailableYears: matchNum(
        text,
        [
          /(?:ersatzteile|spare\s*parts)[^\n]{0,60}?(\d{1,3})\s*(?:jahre|years)/i,
          /(?:verfügbarkeit|availability)[^\n]{0,50}?(\d{1,3})\s*(?:jahre|years)/i,
        ],
        0,
        50,
      ),
      warrantyYears: matchNum(
        text,
        [/(?:garantie|warranty)[\s:]+(\d{1,2})\s*(?:jahre|years)/i],
        0,
        50,
      ),
    };
  }

  private extractEndOfLife(text: string): EndOfLife {
    const HAZARDOUS = [
      'Kobalt', 'Cobalt', 'Nickel', 'Mangan', 'Blei', 'Lead',
      'Cadmium', 'Quecksilber', 'Mercury', 'Fluorid', 'Fluoride',
    ];
    const lower = text.toLowerCase();
    const hazardousSubstances = [...new Set(
      HAZARDOUS.filter((s) => lower.includes(s.toLowerCase())),
    )];

    return {
      recyclingInstructions:
        matchStr(text, [
          /(?:recycling(?:anweisungen|hinweise)|recycling\s*instructions)[\s:]+([^\n,;]{5,200})/i,
          /(?:rückgabe|return|dispose)[^\n]{0,20}[\s:]+([^\n]{5,150})/i,
        ]) || undefined,
      disposalInstructions:
        matchStr(text, [
          /(?:entsorgung(?:shinweise)?|disposal)[\s:]+([^\n,;]{5,200})/i,
        ]) || undefined,
      hazardousSubstances: hazardousSubstances.length ? hazardousSubstances : undefined,
    };
  }

  private extractProductionDate(text: string): string | undefined {
    const patterns = [
      /(?:produktionsdatum|herstellungsdatum|production\s*date|manufacturing\s*date)[\s:]+(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{4})/i,
      /(?:produktionsdatum|herstellungsdatum|production\s*date)[\s:]+(\d{4}-\d{2}-\d{2})/i,
      /(?:datum|date)[\s:]+(\d{1,2}[.]\d{1,2}[.]\d{4})/i,
    ];
    for (const re of patterns) {
      const raw = text.match(re)?.[1];
      if (!raw) continue;
      try {
        const parts = raw.split(/[.\/-]/);
        if (parts.length !== 3) continue;
        let y: number, mo: number, d: number;
        if (Number(parts[0]) > 1000) {
          [y, mo, d] = parts.map(Number);
        } else {
          [d, mo, y] = parts.map(Number);
        }
        const date = new Date(Date.UTC(y, mo - 1, d));
        if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
      } catch {
        /* continue to next pattern */
      }
    }
    return undefined;
  }

  private firstMeaningfulLine(text: string, index: number): string {
    const SKIP = /^(?:seite|page|datum|date|version|revision|stream|endobj|hersteller|manufacturer|xref|trailer)\b/i;
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 3 && l.length < 80 && /[a-zA-ZäöüÄÖÜ]/.test(l) && !SKIP.test(l));
    return lines[index] ?? lines[0] ?? '';
  }
}

// ─── Extractor registry (open for extension) ─────────────────────────────────

const extractorRegistry = new Map<ProductCategory, IExtractor>([
  ['BATTERY', new BatteryRegexExtractor()],
]);

/**
 * Register a custom extractor for a product category.
 * Allows swapping extraction strategy at runtime without touching call sites.
 */
export function registerExtractor(extractor: IExtractor): void {
  extractorRegistry.set(extractor.productType, extractor);
}

// ─── Product type detection ───────────────────────────────────────────────────

function detectCategory(text: string): ProductCategory {
  const scores: Record<ProductCategory, number> = {
    BATTERY: 0, TEXTILE: 0, ELECTRONICS: 0, FURNITURE: 0,
  };
  const lower = text.toLowerCase();
  const KEYWORDS: Record<ProductCategory, string[]> = {
    BATTERY:     ['batterie', 'battery', 'akku', 'kwh', 'lithium', 'nmc', 'lfp', 'ladezyklen'],
    TEXTILE:     ['textil', 'textile', 'stoff', 'baumwolle', 'cotton', 'polyester', 'wolle'],
    ELECTRONICS: ['elektronik', 'electronics', 'cpu', 'prozessor', 'platine', 'watt', 'volt'],
    FURNITURE:   ['möbel', 'furniture', 'holz', 'wood', 'stuhl', 'chair', 'tisch', 'table'],
  };
  for (const [cat, kws] of Object.entries(KEYWORDS) as [ProductCategory, string[]][]) {
    scores[cat] = kws.filter((k) => lower.includes(k)).length;
  }
  const best = (Object.entries(scores) as [ProductCategory, number][])
    .reduce((a, b) => (b[1] > a[1] ? b : a));
  return best[1] > 0 ? best[0] : 'BATTERY';
}

// ─── Confidence scoring ───────────────────────────────────────────────────────

const MANDATORY_KEYS: Array<keyof EsprProductData> = [
  'hersteller', 'modellname', 'capacityKwh', 'chemistry',
];

function scoreConfidence(
  data: Partial<EsprProductData>,
): { confidence: number; warnings: string[] } {
  const missing = MANDATORY_KEYS.filter((k) => !data[k]);
  return {
    confidence: (MANDATORY_KEYS.length - missing.length) / MANDATORY_KEYS.length,
    warnings: missing.map((k) => `Pflichtfeld nicht gefunden: ${String(k)}`),
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Extract ESPR product data from a raw PDF buffer.
 *
 * @param buffer       Raw PDF bytes
 * @param categoryHint Optional product category — auto-detected when omitted
 * @returns Fully typed EsprProductData (never throws; warnings on missing fields)
 */
export async function extractFromPdfBuffer(
  buffer: Buffer,
  categoryHint?: ProductCategory,
): Promise<EsprProductData> {
  // 1. Extract raw text
  let rawText = '';
  try {
    const mod = await import('pdf-parse');
    const pdfParse = (mod as any).default ?? mod;
    rawText = (await pdfParse(buffer)).text ?? '';
  } catch (err) {
    console.warn('[LocalExtractor] pdf-parse failed:', err);
  }

  // 2. Clean structural PDF tokens
  const text = cleanText(rawText);

  // 3. Detect category & pick extractor
  const category = categoryHint ?? detectCategory(text);
  const extractor = extractorRegistry.get(category) ?? new BatteryRegexExtractor();

  // 4. Extract fields
  const partial = extractor.extract(text);

  // 5. Score and assemble
  const { confidence, warnings } = scoreConfidence(partial as Partial<EsprProductData>);

  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    language: 'de',
    type: category,
    manufacturer:     partial.manufacturer     ?? { name: '' },
    hersteller:       partial.hersteller       ?? '',
    model:            partial.model            ?? '',
    modellname:       partial.modellname       ?? '',
    serialNumber:     partial.serialNumber,
    batchNumber:      partial.batchNumber,
    productionDate:   partial.productionDate,
    capacityKwh:      partial.capacityKwh,
    chemistry:        partial.chemistry,
    batteryType:      partial.batteryType,
    nominalVoltageV:  partial.nominalVoltageV,
    weightKg:         partial.weightKg,
    carbonFootprint:  partial.carbonFootprint  ?? {},
    recycledContent:  partial.recycledContent  ?? {},
    lifecycle:        partial.lifecycle        ?? {},
    endOfLife:        partial.endOfLife        ?? {},
    certificationBody:   partial.certificationBody,
    regulatoryReference: partial.regulatoryReference,
    legalNotes:          partial.legalNotes,
    supplyChainInfo:     partial.supplyChainInfo,
    extractionConfidence: confidence,
    extractionWarnings:   warnings,
  };
}
