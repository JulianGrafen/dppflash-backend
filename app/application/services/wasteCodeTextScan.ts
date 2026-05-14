import { WasteCodeService } from '@/app/application/services/WasteCodeService';

const EUROPEAN_WASTE_CODE_PATTERNS: readonly RegExp[] = [
  /\b\d{2}\s+\d{2}\s+\d{2}\s*\*?\b/,
  /\b\d{2}-\d{2}-\d{2}\s*\*?\b/,
  /\b\d{6}\*(?![0-9])/,
];

export interface EuropeanWasteCodeHit {
  readonly snippet: string;
  readonly normalizedValue: string;
}

/**
 * Finds the first plausible European waste catalogue code in plain text (SDS / technical datasheet).
 */
export function findFirstEuropeanWasteCodeInText(text: string): EuropeanWasteCodeHit | undefined {
  for (const re of EUROPEAN_WASTE_CODE_PATTERNS) {
    const m = text.match(re);
    if (!m?.[0]) {
      continue;
    }
    const snippet = m[0].trim();
    const normalized = WasteCodeService.normalize(snippet);
    if (!normalized || !/\d/.test(normalized)) {
      continue;
    }
    const { normalizedCode } = WasteCodeService.resolve(normalized);
    return { snippet, normalizedValue: normalizedCode || normalized };
  }

  return undefined;
}
