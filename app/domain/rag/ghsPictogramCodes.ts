/**
 * Normalisierung und Ableitung von CLP-GHS-Piktogramm-Codes (GHS01–GHS09).
 * LLMs/PDFs liefern oft „05“, 5 oder `ghsPictograms` statt `GHS05` / `ghsSymbols`.
 */

const GHS_SORT_ORDER = ['GHS01', 'GHS02', 'GHS03', 'GHS04', 'GHS05', 'GHS06', 'GHS07', 'GHS08', 'GHS09'] as const;

function sortGhsCodes(codes: Iterable<string>): string[] {
  const set = new Set(codes);
  return GHS_SORT_ORDER.filter((c) => set.has(c));
}

/** Einzelnen Rohwert → kanonisch `GHS0n` (1–9) oder null. */
export function normalizeGhsPictogramCode(raw: unknown): string | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const n = Math.round(raw);
    if (n >= 1 && n <= 9) {
      return `GHS0${n}`;
    }
    return null;
  }
  if (typeof raw !== 'string') {
    return null;
  }
  const t = raw.trim();
  if (!t) {
    return null;
  }
  const compact = t.replace(/\s+/g, '').toUpperCase();
  const ghsMatch = compact.match(/^GHS0?([1-9])$/);
  if (ghsMatch) {
    return `GHS0${ghsMatch[1]}`;
  }
  if (/^0?[1-9]$/.test(compact)) {
    return `GHS0${compact.replace(/^0/, '')}`;
  }
  const embedded = t.match(/\bGHS\s*0?([1-9])\b/i);
  if (embedded) {
    return `GHS0${embedded[1]}`;
  }
  return null;
}

/** Liste/Rohfeld → eindeutige kanonische GHS-Codes. */
export function normalizeGhsPictogramCodeList(raw: unknown): string[] {
  if (raw === undefined || raw === null) {
    return [];
  }
  const items: unknown[] = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
      : [raw];
  const out: string[] = [];
  for (const item of items) {
    const code = normalizeGhsPictogramCode(item);
    if (code) {
      out.push(code);
    }
  }
  return sortGhsCodes(new Set(out));
}

function normalizeHCodeForInference(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

/** Vereinfachte CLP-Zuordnung H-/EUH-Sätze → Piktogramme (Anzeige-Fallback). */
const H_CODE_TO_GHS_RULES: readonly { readonly pattern: RegExp; readonly ghs: string }[] = [
  { pattern: /^H2(00|01|02|03|04|05|06)\b/, ghs: 'GHS01' },
  { pattern: /^H2(08|09|10|11|12|13|14|15|16|17|18|19|20)\b/, ghs: 'GHS02' },
  { pattern: /^H22[0-9]\b/, ghs: 'GHS02' },
  { pattern: /^H24[0-9]\b/, ghs: 'GHS02' },
  { pattern: /^H25[0-9]\b/, ghs: 'GHS02' },
  { pattern: /^H26[01]\b/, ghs: 'GHS02' },
  { pattern: /^H27[0-2]\b/, ghs: 'GHS03' },
  { pattern: /^H28[0-4]\b/, ghs: 'GHS04' },
  { pattern: /^H290\b/, ghs: 'GHS05' },
  { pattern: /^H3(14|18)\b/, ghs: 'GHS05' },
  { pattern: /^H3(00|301|310|311|330|331)\b/, ghs: 'GHS06' },
  { pattern: /^H332\b/, ghs: 'GHS06' },
  { pattern: /^H3(02|15|317|319|335|336)\b/, ghs: 'GHS07' },
  { pattern: /^H3(34|340|341|350|351|360|361|370|371|372|373)\b/, ghs: 'GHS08' },
  { pattern: /^H4(00|410|411|412|413|420)\b/, ghs: 'GHS09' },
  { pattern: /^EUH0/, ghs: 'GHS07' },
];

/** Leitet Piktogramm-Codes aus Gemisch-H-Sätzen ab (wenn PDF nur Bilder hatte). */
export function inferGhsPictogramsFromHStatements(hStatements: readonly string[]): string[] {
  const out = new Set<string>();
  for (const raw of hStatements) {
    const h = normalizeHCodeForInference(String(raw));
    if (!/^H\d/.test(h) && !/^EUH/.test(h)) {
      continue;
    }
    for (const rule of H_CODE_TO_GHS_RULES) {
      if (rule.pattern.test(h)) {
        out.add(rule.ghs);
      }
    }
  }
  return sortGhsCodes(out);
}
