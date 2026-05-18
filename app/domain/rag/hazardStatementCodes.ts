/** CLP Gefahren- und Sicherheitshinweise (H…, EUH…, P…) aus Texten und JSON-Arrays. */

const H_STATEMENT_RE = /\b(EUH\d{3}[A-Za-z]*|H\d{3}[A-Za-z]*)\b/gi;
const P_STATEMENT_RE = /\b(P\d{3}[A-Za-z]*)\b/gi;

function normalizeHpToken(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

export function extractHazardStatementCodesFromText(text: string): string[] {
  const m = text.match(H_STATEMENT_RE);
  if (!m) {
    return [];
  }
  return [...new Set(m.map((c) => normalizeHpToken(c)))];
}

export function extractPrecautionaryStatementCodesFromText(text: string): string[] {
  const m = text.match(P_STATEMENT_RE);
  if (!m) {
    return [];
  }
  return [...new Set(m.map((c) => normalizeHpToken(c)))];
}

export function extractHazardStatementCodesFromTexts(texts: readonly string[]): string[] {
  const out = new Set<string>();
  for (const t of texts) {
    for (const c of extractHazardStatementCodesFromText(t)) {
      out.add(c);
    }
  }
  return [...out].sort();
}

export function extractPrecautionaryStatementCodesFromTexts(texts: readonly string[]): string[] {
  const out = new Set<string>();
  for (const t of texts) {
    for (const c of extractPrecautionaryStatementCodesFromText(t)) {
      out.add(c);
    }
  }
  return [...out].sort();
}

function flattenToStringChunks(raw: unknown): string[] {
  if (raw === null || raw === undefined) {
    return [];
  }
  if (Array.isArray(raw)) {
    return raw.flatMap((x) => flattenToStringChunks(x));
  }
  if (typeof raw === 'string') {
    return [raw];
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return [String(raw)];
  }
  return [];
}

/** H-/EUH-Codes aus Arrays, Kommalisten und Freitext (z. B. Einstufung „STOT SE 3, H335“). */
export function normalizeHazardStatementCodeList(raw: unknown): string[] {
  const texts = flattenToStringChunks(raw);
  const fromText = extractHazardStatementCodesFromTexts(texts);
  const fromTokens = texts
    .flatMap((t) => t.split(/[,;]/).map((s) => s.trim()).filter(Boolean))
    .filter((t) => /^(EUH|H)\d/i.test(t))
    .map(normalizeHpToken);
  return [...new Set([...fromText, ...fromTokens])].sort();
}

/** P-Codes aus Arrays und Freitext. */
export function normalizePrecautionaryStatementCodeList(raw: unknown): string[] {
  const texts = flattenToStringChunks(raw);
  const fromText = extractPrecautionaryStatementCodesFromTexts(texts);
  const fromTokens = texts
    .flatMap((t) => t.split(/[,;]/).map((s) => s.trim()).filter(Boolean))
    .filter((t) => /^P\d/i.test(t))
    .map(normalizeHpToken);
  return [...new Set([...fromText, ...fromTokens])].sort();
}
