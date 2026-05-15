import { getRagTargetFieldKeysForProductType } from '@/app/domain/rag/ragPassportFieldTargets';
import type { ProductPassport } from '@/app/types/dpp-types';

const PENDING = 'PENDING_EXTERNAL_MATCH';

/**
 * Technische Passport-Keys → deutschsprachige Suchbegriffe (PDF/SDS/ESPR-typisch),
 * damit Embedding + BM25 näher an deutschen Ziel-Dokumenten landen.
 */
export const RAG_GAP_SEMANTIC_FIELD_MAP: Readonly<Record<string, string>> = {
  materialComposition: 'Zusammensetzung, Rohstoffe, Material, Bestandteile',
  chemicalComposition: 'Chemische Eigenschaften, Rezeptur, Abschnitt 3, CAS-Nummern',
  gtin: 'GTIN, EAN, Artikelnummer, Barcode',
  manufacturer: 'Hersteller, Lieferant, Inverkehrbringer, Abschnitt 1',
  hersteller: 'Hersteller, Firma, Marke, Lieferant',
  modellname: 'Modell, Typenbezeichnung, Produktbezeichnung',
  productName: 'Produktname, Handelsname, Bezeichnung',
  wasteCode: 'Abfallschlüssel, EWC, EAK, AVV, Abfallschlüsselnummer',
  ewcCode: 'Abfallschlüssel, EWC, EAK, AVV',
  endOfLifeInstructions: 'Entsorgung, Abschnitt 13, End-of-Life, Recyclinghinweise',
  countryOfOrigin: 'Ursprungsland, Herkunftsland, country of origin',
  countryOfManufacturing: 'Herstellungsland, Produktionsland',
  declaredProductType: 'Produktkategorie, Produkttyp, Anwendung',
  zusammensetzung: 'Zusammensetzung, Inhaltsstoffe, Rezeptur, Abschnitt 3, Anteile',
  substancesOfConcern: 'besorgniserregende Stoffe, SVHC, Grenzwert, Zulassungsbedingungen',
  gefahrenstoffe: 'Gefahrenstoffe, besorgniserregende Stoffe, SVHC, Abschnitt 3, Länderliste',
  herkunftsland: 'Herkunftsland, Ursprung, Made in',
  entsorgungshinweise: 'Entsorgung, Abschnitt 13, Entsorgungshinweise',
  recyclingAnweisungen: 'Recycling, Rücknahme, Entsorgung',
};

/** Einzel-Key → deutscher Suchteil (Fallback: technischer Key). */
export function mapGapFieldKeyToGermanSearchPhrase(fieldKey: string): string {
  return RAG_GAP_SEMANTIC_FIELD_MAP[fieldKey] ?? fieldKey;
}

/**
 * Alle Lücken-Felder als zusammenhängende deutschsprachige Suchphrase (Semikolon getrennt).
 */
export function buildGermanGapSearchTerms(missingFieldKeys: readonly string[]): string {
  if (missingFieldKeys.length === 0) {
    return 'ESPR Kennfelder, Stammdaten, technisches Datenblatt';
  }
  return missingFieldKeys.map(mapGapFieldKeyToGermanSearchPhrase).join('; ');
}

function isEmptyPassportScalar(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  if (typeof value === 'string') {
    const t = value.trim();
    return t === '' || t === PENDING;
  }
  return false;
}

function isCompositionMassFractionGapFilled(value: unknown): boolean {
  if (Array.isArray(value) && value.length > 0) {
    return true;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    return true;
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const inner = (value as Record<string, unknown>).value;
    if (Array.isArray(inner) && inner.length > 0) {
      return true;
    }
    if (typeof inner === 'string' && inner.trim() !== '') {
      return true;
    }
    if (typeof inner === 'number' && Number.isFinite(inner)) {
      return true;
    }
  }
  return false;
}

function isEmptyForRagGap(key: string, value: unknown): boolean {
  if (key === 'materialComposition') {
    if (Array.isArray(value) && value.length > 0) {
      return false;
    }
    if (typeof value === 'string' && value.trim() !== '') {
      return false;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const inner = (value as Record<string, unknown>).value;
      if (typeof inner === 'string' && inner.trim() !== '') {
        return false;
      }
    }
    return true;
  }
  if (
    key === 'chemicalComposition'
    || key === 'materialZusammensetzung'
    || key === 'zusammensetzung'
  ) {
    return !isCompositionMassFractionGapFilled(value);
  }
  if (key === 'gefahrenstoffe') {
    if (Array.isArray(value) && value.length > 0) {
      return false;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const inner = (value as Record<string, unknown>).value;
      if (Array.isArray(inner) && inner.length > 0) {
        return false;
      }
      if (typeof inner === 'string' && inner.trim() !== '') {
        return false;
      }
    }
    return true;
  }
  if (key === 'manufacturer') {
    if (value === undefined || value === null || typeof value !== 'object') {
      return true;
    }
    const m = value as Record<string, unknown>;
    const name = typeof m.name === 'string' ? m.name.trim() : '';
    return name === '';
  }
  return isEmptyPassportScalar(value);
}

/**
 * Schritt 2: Felder, die für RAG-Nachziehen noch leer sind (Schnitt mit erlaubten RAG-Ziel-Keys).
 */
export function detectRagFillableGaps(
  passport: Record<string, unknown>,
  productType: ProductPassport['type'],
): readonly string[] {
  const allowed = new Set(getRagTargetFieldKeysForProductType(productType));
  const gaps: string[] = [];
  for (const key of allowed) {
    if (isEmptyForRagGap(key, passport[key])) {
      gaps.push(key);
    }
  }
  return gaps;
}

/**
 * Schritt 2 (Anker): ESPR-`productName`, sonst Fallback `modellname` — ohne Anker kein Targeted RAG.
 */
export function resolvePrimaryProductNameAnchor(passport: Record<string, unknown>): string | null {
  const productName = passport.productName;
  if (typeof productName === 'string') {
    const t = productName.trim();
    if (t.length > 0) {
      return t;
    }
  }
  const modellname = passport.modellname;
  if (typeof modellname === 'string') {
    const t = modellname.trim();
    if (t.length > 0) {
      return t;
    }
  }
  return null;
}

/** Schritt 2/3: Such-String für Vektor/BM25 (deutsch, PDF-tauglich). */
export function buildGapTargetedSearchQuery(
  missingFieldKeys: readonly string[],
  anchorProductName: string,
): string {
  const terms = buildGermanGapSearchTerms(missingFieldKeys);
  return `Suche nach: ${terms} für das Produkt: ${anchorProductName}`;
}
