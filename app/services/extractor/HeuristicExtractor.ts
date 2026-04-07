/**
 * HeuristicExtractor — Intelligent keyword-adjacent value extraction
 *
 * Philosophy
 * ──────────
 * Simple `.match()` breaks when layouts change.  This extractor uses a
 * multi-pass approach:
 *
 *   1. Label-value proximity search  — find a keyword, look at the text
 *      immediately to its right and on the following line(s).
 *   2. Domain lookup tables          — known chemistry names, manufacturers, etc.
 *   3. Structural pattern matching   — unit suffixes (kWh, V, kg, %) anchor
 *      numbers without requiring a labelled context.
 *   4. Cover-page heuristics         — when labels are absent, the first/second
 *      meaningful line is the manufacturer / model name respectively.
 *
 * Adding a new field
 * ──────────────────
 * 1. Add its keywords to `FIELD_LABELS`.
 * 2. Call `labelValue()` or `nearestNumber()` in `extract()`.
 * 3. Add it to `MANDATORY_FIELDS` if it should influence confidence.
 *
 * GDPR: zero network calls — runs entirely in process.
 */

import type {
  ExtractionResult,
  ExtractedField,
  ExtractionFieldMap,
  IHeuristicExtractor,
} from '../../types/extraction';
import type {
  EsprProductData,
  CarbonFootprint,
  RecycledContent,
  Lifecycle,
  EndOfLife,
  Manufacturer,
} from '../../types/espr';

// ─── Keyword label tables ────────────────────────────────────────────────────
// Each array lists every synonym the extractor will recognise, in both German
// and English.  Add synonyms here — no other code changes needed.

const FIELD_LABELS = {
  manufacturer: [
    'hersteller', 'manufacturer', 'produzent', 'producer', 'brand',
    'fabrikant', 'company', 'unternehmen', 'firma',
  ],
  model: [
    'modellname', 'modell', 'model name', 'model', 'produktname',
    'product name', 'bezeichnung', 'produktbezeichnung', 'type', 'typ',
  ],
  serial: [
    'seriennummer', 'serial number', 'serial no', 'sn', 's/n', 'serialnr',
  ],
  batch: [
    'chargennummer', 'charge', 'batch number', 'batch no', 'lot', 'lot number',
  ],
  capacity: [
    'kapazität', 'nennkapazität', 'capacity', 'rated capacity',
    'energieinhalt', 'energy content', 'akkukapazität',
  ],
  voltage: [
    'nennspannung', 'nominal voltage', 'spannung', 'voltage', 'betriebsspannung',
  ],
  weight: [
    'gewicht', 'weight', 'masse', 'mass', 'nettogewicht',
  ],
  chemistry: [
    'chemisches system', 'zellchemie', 'chemistry', 'chemie',
    'elektrochemie', 'electrochemistry', 'zelltyp',
  ],
  batteryType: [
    'batterietyp', 'battery type', 'akku typ', 'typ', 'anwendung', 'application',
  ],
  co2Total: [
    'co2-fußabdruck', 'co2 fußabdruck', 'kohlenstoff', 'carbon footprint',
    'treibhausgasemissionen', 'ghg', 'co2e gesamt', 'co2-äquivalent',
    'co2 äquivalent', 'co2-emissionen',
  ],
  co2PerKwh: [
    'co2 pro kwh', 'co2e/kwh', 'co2/kwh', 'kg co2e/kwh',
    'carbon intensity', 'spezifischer co2',
  ],
  recycledCobalt: [
    'recyclinganteil kobalt', 'recycled cobalt', 'kobalt recycling', 'cobalt %',
  ],
  recycledLithium: [
    'recyclinganteil lithium', 'recycled lithium', 'lithium recycling', 'lithium %',
  ],
  recycledNickel: [
    'recyclinganteil nickel', 'recycled nickel', 'nickel recycling', 'nickel %',
  ],
  expectedCycles: [
    'ladezyklen', 'charge cycles', 'zyklen', 'cycles', 'ladekreisläufe',
    'erwartete ladezyklen', 'expected cycles',
  ],
  repairability: [
    'reparierbarkeitsindex', 'reparierbarkeit', 'repairability', 'reparatur index',
  ],
  spareParts: [
    'ersatzteilverfügbarkeit', 'spare parts', 'ersatzteile jahre',
    'ersatzteile verfügbar', 'parts availability',
  ],
  recyclingInstructions: [
    'recyclinganweisungen', 'entsorgungshinweise', 'disposal', 'recycling instructions',
    'entsorgung', 'end of life', 'end-of-life',
  ],
  certificationBody: [
    'zertifizierungsstelle', 'certification body', 'zertifikat', 'akkreditiert', 'notified body',
  ],
  productionDate: [
    'herstellungsdatum', 'produktionsdatum', 'production date', 'manufacture date',
    'datum', 'baujahr', 'year of manufacture',
  ],
} as const;

// ─── Known chemistry name lookup ──────────────────────────────────────────────

const CHEMISTRY_LOOKUP: Array<[RegExp, string]> = [
  [/\bLiFePO4\b|\bLFP\b/i,                    'LiFePO4 (LFP)'],
  [/\bNMC\b|\bNCM\b|\bNi.?Mn.?Co/i,           'NMC'],
  [/\bNCA\b|\bNi.?Co.?Al/i,                   'NCA'],
  [/\bLCO\b|\bLithium.?Cobalt.?Oxid/i,        'LCO'],
  [/\bNiMH\b|\bNickel.?Metall.?Hydrid/i,      'NiMH'],
  [/\bBlei.?S.ure|\bLead.?Acid/i,             'Blei-Säure'],
  [/\bNatrium.?Ion|\bSodium.?Ion/i,           'Natrium-Ionen'],
  [/\bFest.?Elektrolyt|\bSolid.?State/i,      'Fest-Elektrolyt'],
  [/\bLi.?Ion|\bLithium.?Ion/i,               'Lithium-Ionen'],
];

// ─── Known battery manufacturer lookup ───────────────────────────────────────

const KNOWN_MANUFACTURERS: Array<{ canonical: string; keywords: string[] }> = [
  { canonical: 'LG Chem',      keywords: ['lg chem', 'lg energy', 'lge'] },
  { canonical: 'Samsung SDI',  keywords: ['samsung sdi', 'samsung'] },
  { canonical: 'CATL',         keywords: ['catl', 'contemporary amperex'] },
  { canonical: 'Panasonic',    keywords: ['panasonic'] },
  { canonical: 'BYD',          keywords: ['byd'] },
  { canonical: 'Tesla',        keywords: ['tesla'] },
  { canonical: 'Northvolt',    keywords: ['northvolt'] },
  { canonical: 'VARTA',        keywords: ['varta'] },
  { canonical: 'Saft',         keywords: ['saft '] },
  { canonical: 'Bosch',        keywords: ['bosch'] },
  { canonical: 'Siemens',      keywords: ['siemens'] },
  { canonical: 'TechVolt',     keywords: ['techvolt'] },
  { canonical: 'PowerCell',    keywords: ['powercell'] },
  { canonical: 'Volkswagen',   keywords: ['volkswagen', ' vw '] },
  { canonical: 'BMW',          keywords: [' bmw '] },
  { canonical: 'Mercedes-Benz', keywords: ['mercedes', 'daimler'] },
];

// ─── Primitive extraction helpers ────────────────────────────────────────────

/** Normalise German/English number strings to float. */
function parseNumber(raw: string): number {
  const s = raw.trim();
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return parseFloat(s.replace(/\./g, ''));       // 1.234
  if (/^\d{1,3}(,\d{3})+$/.test(s))  return parseFloat(s.replace(/,/g, ''));        // 1,234
  if (s.includes(',') && !s.includes('.')) return parseFloat(s.replace(',', '.'));   // 1,5
  if (s.includes('.') && s.includes(','))                                             // 1.234,56
    return parseFloat(s.replace(/\./g, '').replace(',', '.'));
  return parseFloat(s);
}

/**
 * Label-value proximity search.
 *
 * Strategy:
 *   (a) `label: value` on one line  — inline after colon
 *   (b) `label` at end of line, value on the next non-empty line
 *
 * Returns `ExtractedField` with source description, or `undefined`.
 */
function labelValue(
  text: string,
  labels: readonly string[],
  maxValueLen = 120,
): ExtractedField<string> | undefined {
  const labelPattern = labels
    .map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');

  // (a) Inline: "Hersteller: Tesla GmbH"
  // Stop at the next label boundary (Word:) — handles single-line PDFs.
  const inlineRe = new RegExp(
    `(?:${labelPattern})[\\s:–\\-]+([^\\n,;]{2,${maxValueLen}}?)(?=\\s+[A-ZÄÖÜa-z][a-zäöüÄÖÜ]\\w*\\s*[:\\-]|\\n|$|,|;)`,
    'i',
  );
  const inlineMatch = text.match(inlineRe);
  if (inlineMatch?.[1]) {
    const value = inlineMatch[1].trim().replace(/\s{2,}/g, ' ');
    if (value.length > 1) {
      return { value, source: 'label-inline', fieldConfidence: 0.9 };
    }
  }

  // (b) Line-break: label alone on line, value on next line
  const lines = text.split('\n').map((l) => l.trim());
  const labelRe = new RegExp(`^(?:${labelPattern})\\s*[:\\-]?\\s*$`, 'i');

  for (let i = 0; i < lines.length - 1; i++) {
    if (labelRe.test(lines[i])) {
      const next = lines.slice(i + 1).find((l) => l.length > 1);
      if (next && next.length <= maxValueLen) {
        return {
          value: next.trim(),
          source: 'label-next-line',
          fieldConfidence: 0.75,
        };
      }
    }
  }

  return undefined;
}

/**
 * Find the nearest number after any recognised label.
 * Handles units: "85 kg CO₂e/kWh" → 85, "100 kWh" → 100.
 */
function nearestNumber(
  text: string,
  labels: readonly string[],
  unitHint?: RegExp,
  min?: number,
  max?: number,
): ExtractedField<number> | undefined {
  const labelPattern = labels
    .map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');

  const strategies: RegExp[] = [
    // Label, then number (with optional unit nearby)
    new RegExp(`(?:${labelPattern})[\\s:–\\-]+(\\d[\\d.,]*)`, 'i'),
    // Number followed by unit hint
    ...(unitHint ? [new RegExp(`(\\d[\\d.,]*)\\s*${unitHint.source}`, 'i')] : []),
  ];

  for (const re of strategies) {
    const raw = text.match(re)?.[1];
    if (!raw) continue;
    const v = parseNumber(raw);
    if (isNaN(v)) continue;
    if (min !== undefined && v < min) continue;
    if (max !== undefined && v > max) continue;
    const source = re.source.startsWith('(?:') ? 'label-number' : 'unit-anchor';
    return { value: v, source, fieldConfidence: 0.85 };
  }
  return undefined;
}

/** Find a percentage value (0–100) near any of the given labels. */
function nearestPercent(
  text: string,
  labels: readonly string[],
): ExtractedField<number> | undefined {
  const labelPattern = labels
    .map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');

  const re = new RegExp(
    `(?:${labelPattern})[\\s:–\\-]{0,10}?(?:[a-zA-Z\\s]{0,20}?)(\\d{1,3}(?:[.,]\\d{1,2})?)\\s*%`,
    'i',
  );
  const raw = text.match(re)?.[1];
  if (!raw) return undefined;
  const v = parseNumber(raw);
  if (isNaN(v) || v < 0 || v > 100) return undefined;
  return { value: v, source: 'label-percent', fieldConfidence: 0.85 };
}

/**
 * Cover-page heuristic: split text into lines, skip known junk/header lines,
 * return the nth usable line.  Only accepts lines containing a real word
 * (4+ consecutive letters) to filter garbled custom-font output.
 */
function coverPageLine(text: string, index: number): ExtractedField<string> | undefined {
  const SKIP = /^(?:seite|page|datum|date|version|revision|stream|endobj|xref|trailer|%%eof)\b/i;
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(
      (l) =>
        l.length > 2 &&
        l.length < 100 &&
        /[a-zA-ZäöüÄÖÜ]{4,}/.test(l) &&   // real word, not garbled glyphs
        !SKIP.test(l),
    );

  // Prefer short lines (likely headings), fall back to any line
  const short = lines.filter((l) => l.length < 60);
  const pool = short.length > 0 ? short : lines;
  const value = pool[index] ?? pool[0];

  return value
    ? { value, source: 'cover-page-heuristic', fieldConfidence: 0.45 }
    : undefined;
}

/** Extract an ISO-8601 date from common date patterns near optional labels. */
function extractDate(text: string, labels: readonly string[]): string | undefined {
  const labelPattern = labels
    .map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');

  const patterns = [
    // After label: "Herstellungsdatum: 2024-03-15" or "15.03.2024"
    new RegExp(`(?:${labelPattern})[\\s:–\\-]+(\\d{4}[\\-./]\\d{2}[\\-./]\\d{2})`, 'i'),
    new RegExp(`(?:${labelPattern})[\\s:–\\-]+(\\d{2}[\\-./]\\d{2}[\\-./]\\d{4})`, 'i'),
    // Year-only as last resort
    new RegExp(`(?:${labelPattern})[\\s:–\\-]+(\\d{4})`, 'i'),
  ];

  for (const re of patterns) {
    const m = text.match(re)?.[1];
    if (!m) continue;

    // Normalise to ISO-8601
    const parts = m.split(/[\/.\-]/);
    if (parts.length === 3) {
      const [a, b, c] = parts;
      if (a.length === 4) {
        // YYYY-MM-DD
        const d = new Date(Date.UTC(+a, +b - 1, +c));
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
      } else {
        // DD.MM.YYYY
        const d = new Date(Date.UTC(+c, +b - 1, +a));
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
      }
    }
    if (parts.length === 1 && m.length === 4) return m; // year only
  }
  return undefined;
}

// ─── Confidence scoring ───────────────────────────────────────────────────────

const MANDATORY_FIELDS: ReadonlyArray<keyof EsprProductData> = [
  'hersteller', 'modellname', 'capacityKwh', 'chemistry',
];

function computeConfidence(
  data: Partial<EsprProductData>,
  warnings: string[],
): number {
  const found = MANDATORY_FIELDS.filter((k) => {
    const v = data[k];
    return v !== undefined && v !== '' && v !== 0;
  }).length;
  return found / MANDATORY_FIELDS.length;
}

// ─── Main extractor class ─────────────────────────────────────────────────────

/**
 * Battery / ESPR heuristic extractor.
 *
 * Implements `IHeuristicExtractor<EsprProductData>` so it can be swapped
 * for any other extractor (e.g., a textile extractor) without touching
 * `PdfProcessingService`.
 */
export class BatteryHeuristicExtractor
  implements IHeuristicExtractor<EsprProductData>
{
  readonly name = 'BatteryHeuristicExtractor v2';

  extract(rawText: string): ExtractionResult<EsprProductData> {
    const warnings: string[] = [];
    const fieldMap: ExtractionFieldMap<EsprProductData> = {};

    // ── Manufacturer ──────────────────────────────────────────────────────────
    const manufacturerField =
      this.findManufacturer(rawText) ?? coverPageLine(rawText, 0);
    fieldMap.hersteller = manufacturerField as ExtractedField<string> | undefined;

    // ── Model ─────────────────────────────────────────────────────────────────
    const modelField =
      labelValue(rawText, FIELD_LABELS.model) ?? coverPageLine(rawText, 1);
    fieldMap.modellname = modelField as ExtractedField<string> | undefined;

    // ── Serial / batch ────────────────────────────────────────────────────────
    const serialField = labelValue(rawText, FIELD_LABELS.serial, 60);
    fieldMap.serialNumber = serialField as ExtractedField<string | undefined> | undefined;

    const batchField = labelValue(rawText, FIELD_LABELS.batch, 60);
    fieldMap.batchNumber = batchField as ExtractedField<string | undefined> | undefined;

    // ── Capacity ──────────────────────────────────────────────────────────────
    const capacityField =
      nearestNumber(rawText, FIELD_LABELS.capacity, /kwh/i, 0.01, 100_000) ??
      nearestNumber(rawText, FIELD_LABELS.capacity, /wh/i, 0.01, 100_000_000);
    fieldMap.capacityKwh = capacityField as ExtractedField<number | undefined> | undefined;

    // ── Chemistry ─────────────────────────────────────────────────────────────
    const chemistryField = this.findChemistry(rawText);
    fieldMap.chemistry = chemistryField as ExtractedField<string | undefined> | undefined;

    // ── Battery type ──────────────────────────────────────────────────────────
    const batteryTypeField = labelValue(rawText, FIELD_LABELS.batteryType, 60);
    fieldMap.batteryType = batteryTypeField as ExtractedField<string | undefined> | undefined;

    // ── Voltage ───────────────────────────────────────────────────────────────
    const voltageField = nearestNumber(rawText, FIELD_LABELS.voltage, /v(?:olt)?/i, 1, 100_000);
    fieldMap.nominalVoltageV = voltageField as ExtractedField<number | undefined> | undefined;

    // ── Weight ────────────────────────────────────────────────────────────────
    const weightField = nearestNumber(rawText, FIELD_LABELS.weight, /kg/i, 0.001, 100_000);
    fieldMap.weightKg = weightField as ExtractedField<number | undefined> | undefined;

    // ── Carbon footprint ──────────────────────────────────────────────────────
    const co2TotalField = nearestNumber(rawText, FIELD_LABELS.co2Total, /kg\s*co2/i, 0, 1_000_000);
    const co2PerKwhField = nearestNumber(rawText, FIELD_LABELS.co2PerKwh, /kg\s*co2e?\/kwh/i, 0, 10_000);

    // ── Recycled content ──────────────────────────────────────────────────────
    const recycledCobaltField = nearestPercent(rawText, FIELD_LABELS.recycledCobalt);
    const recycledLithiumField = nearestPercent(rawText, FIELD_LABELS.recycledLithium);
    const recycledNickelField = nearestPercent(rawText, FIELD_LABELS.recycledNickel);

    // ── Lifecycle ─────────────────────────────────────────────────────────────
    const expectedCyclesField = nearestNumber(rawText, FIELD_LABELS.expectedCycles, undefined, 1, 100_000);
    const repairabilityField = nearestNumber(rawText, FIELD_LABELS.repairability, undefined, 0, 10);
    const sparePartsField = nearestNumber(rawText, FIELD_LABELS.spareParts, /jahre?|years?/i, 0, 100);

    // ── End-of-life ───────────────────────────────────────────────────────────
    const recyclingInstrField = labelValue(rawText, FIELD_LABELS.recyclingInstructions, 300);

    // ── Regulatory ────────────────────────────────────────────────────────────
    const certBodyField = labelValue(rawText, FIELD_LABELS.certificationBody, 80);

    // ── Production date ───────────────────────────────────────────────────────
    const prodDate = extractDate(rawText, FIELD_LABELS.productionDate);

    // ── Assemble typed data object ────────────────────────────────────────────
    const manufacturer: Manufacturer = {
      name: manufacturerField?.value ?? '',
    };

    const carbonFootprint: CarbonFootprint = {
      totalKg:   co2TotalField?.value,
      perKwhKg:  co2PerKwhField?.value,
    };

    const recycledContent: RecycledContent = {
      cobaltPct:  recycledCobaltField?.value,
      lithiumPct: recycledLithiumField?.value,
      nickelPct:  recycledNickelField?.value,
    };

    const lifecycle: Lifecycle = {
      expectedCycles:          expectedCyclesField?.value,
      repairabilityScore:      repairabilityField?.value,
      sparePartsAvailableYears: sparePartsField?.value,
    };

    const endOfLife: EndOfLife = {
      recyclingInstructions: recyclingInstrField?.value,
    };

    const data: Partial<EsprProductData> = {
      manufacturer,
      hersteller:      manufacturerField?.value || undefined,
      model:           modelField?.value || undefined,
      modellname:      modelField?.value || undefined,
      serialNumber:    serialField?.value || undefined,
      batchNumber:     batchField?.value || undefined,
      productionDate:  prodDate,
      capacityKwh:     capacityField?.value,
      chemistry:       chemistryField?.value,
      batteryType:     batteryTypeField?.value || undefined,
      nominalVoltageV: voltageField?.value,
      weightKg:        weightField?.value,
      carbonFootprint,
      recycledContent,
      lifecycle,
      endOfLife,
      certificationBody: certBodyField?.value || undefined,
    };

    // ── Warnings for mandatory missing fields ─────────────────────────────────
    const missingLabels: string[] = [];
    if (!data.hersteller)   missingLabels.push('Hersteller');
    if (!data.modellname)   missingLabels.push('Modellname');
    if (!data.capacityKwh)  missingLabels.push('Kapazität (kWh)');
    if (!data.chemistry)    missingLabels.push('Chemisches System');

    if (missingLabels.length > 0) {
      warnings.push(`Fehlende Pflichtfelder: ${missingLabels.join(', ')}`);
    }

    const confidence = computeConfidence(data, warnings);

    return { data, confidence, warnings, fieldMap };
  }

  // ─── Private extraction helpers ──────────────────────────────────────────────

  /** Manufacturer search: label proximity → known-name lookup → GmbH/AG pattern. */
  private findManufacturer(text: string): ExtractedField<string> | undefined {
    // 1. Label-value proximity
    const fromLabel = labelValue(text, FIELD_LABELS.manufacturer, 100);
    if (fromLabel) return fromLabel;

    // 2. Known-manufacturer lookup (case-insensitive)
    const lower = text.toLowerCase();
    for (const { canonical, keywords } of KNOWN_MANUFACTURERS) {
      if (keywords.some((kw) => lower.includes(kw))) {
        return { value: canonical, source: 'known-manufacturer-list', fieldConfidence: 0.95 };
      }
    }

    // 3. Legal-form pattern: "Acme GmbH", "Battery Systems AG"
    const legalRe =
      /\b([A-Z][a-zA-Z0-9 &\-]{2,50}(?:GmbH|AG|Inc\.?|Ltd\.?|SE|KG|SA|BV|SAS|SRL|NV))\b/;
    const legalMatch = text.match(legalRe)?.[1]?.trim();
    if (legalMatch && legalMatch.length <= 80) {
      return { value: legalMatch, source: 'legal-form-pattern', fieldConfidence: 0.7 };
    }

    return undefined;
  }

  /** Chemistry: lookup table first (most reliable), then proximity label search. */
  private findChemistry(text: string): ExtractedField<string> | undefined {
    for (const [re, canonical] of CHEMISTRY_LOOKUP) {
      if (re.test(text)) {
        return { value: canonical, source: 'chemistry-lookup', fieldConfidence: 0.95 };
      }
    }
    const fromLabel = labelValue(text, FIELD_LABELS.chemistry, 60);
    return fromLabel ?? undefined;
  }
}
