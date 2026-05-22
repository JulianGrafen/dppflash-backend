/**
 * Compliance-PDF-Metadaten in `products.extracted_attributes.sourceDocuments`.
 */

export type ComplianceSourceDocument = {
  readonly title: string;
  readonly url: string;
  readonly type: string;
};

export type ComplianceDocumentClassification = {
  readonly type: 'safety_data_sheet' | 'rohs_confirmation' | 'regulatory_data_sheet';
  readonly title: string;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function isSafetyDataSheet(fileName: string, documentText: string): boolean {
  const haystack = normalizeSearchText(`${fileName}\n${documentText.slice(0, 12_000)}`);
  return (
    haystack.includes('sicherheitsdatenblatt')
    || /\bsdb\b/.test(haystack)
    || haystack.includes('safety data sheet')
    || /\bsds\b/.test(haystack)
    || /\bmsds\b/.test(haystack)
  );
}

function isRohsConfirmation(fileName: string, documentText: string): boolean {
  const haystack = normalizeSearchText(`${fileName}\n${documentText.slice(0, 24_000)}`);
  return (
    /\brohs\b/.test(haystack)
    && (
      haystack.includes('confirmation')
      || haystack.includes('confirms')
      || haystack.includes('declaration')
      || haystack.includes('conformity')
      || haystack.includes('compliance')
      || haystack.includes('bestatigung')
      || haystack.includes('konformitat')
      || haystack.includes('konformitaet')
    )
  );
}

function isRegulatoryDataSheet(documentText: string): boolean {
  const firstPages = normalizeSearchText(documentText.slice(0, 16_000));
  return (
    /^\s*regulatorisches datenblatt\b/im.test(firstPages)
    || /\n\s*regulatorisches datenblatt\b/i.test(firstPages)
    || /\brds\b.{0,80}\bregulatorisches datenblatt\b/i.test(firstPages)
    || /\bregulatorisches datenblatt\b.{0,80}\brds\b/i.test(firstPages)
  );
}

export function classifyComplianceDocument(
  fileName: string,
  documentText: string,
): ComplianceDocumentClassification | null {
  if (isRegulatoryDataSheet(documentText)) {
    return { type: 'regulatory_data_sheet', title: 'Regulatorisches Datenblatt' };
  }
  if (isRohsConfirmation(fileName, documentText)) {
    return { type: 'rohs_confirmation', title: 'RoHS Confirmation' };
  }
  if (isSafetyDataSheet(fileName, documentText)) {
    return { type: 'safety_data_sheet', title: 'Sicherheitsdatenblatt' };
  }
  return null;
}

export function inferComplianceDocumentType(fileName: string, documentText = ''): string {
  const classified = classifyComplianceDocument(fileName, documentText);
  if (classified) {
    return classified.type;
  }
  const lower = fileName.toLowerCase();
  if (
    lower.includes('sdb')
    || lower.includes('sicherheitsdatenblatt')
    || lower.includes('safety')
    || lower.includes('msds')
    || lower.includes('sds')
  ) {
    return 'safety_data_sheet';
  }
  return 'compliance_pdf';
}

export function titleFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/i, '').trim();
  const human = base.replace(/[-_]+/g, ' ').trim();
  return human.length > 0 ? human : fileName;
}

export function parseComplianceSourceDocuments(raw: unknown): ComplianceSourceDocument[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: ComplianceSourceDocument[] = [];
  for (const item of raw) {
    if (!isRecord(item)) {
      continue;
    }
    const title = typeof item.title === 'string' ? item.title.trim() : '';
    const url = typeof item.url === 'string' ? item.url.trim() : '';
    const type = typeof item.type === 'string' ? item.type.trim() : 'compliance_pdf';
    if (!title || !url) {
      continue;
    }
    out.push({ title, url, type });
  }
  return out;
}

/** **Normalisiert** Datei- und Titelstrings für robustes Matching (SDB ↔ Storage-Dateiname). */
export function normalizeDocumentMatchKey(value: string): string {
  return normalizeSearchText(value).replace(/[^a-z0-9]/g, '');
}

export function basenameFromDocumentUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    return path.split('/').pop() ?? '';
  } catch {
    const withoutQuery = url.split('?')[0] ?? url;
    return withoutQuery.split('/').pop() ?? '';
  }
}

function stripStorageUuidPrefix(fileBaseName: string): string {
  return fileBaseName.replace(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i,
    '',
  );
}

function keysOverlap(a: string, b: string): boolean {
  if (!a || !b) {
    return false;
  }
  return a.includes(b) || b.includes(a);
}

function extractMatchTokens(normalizedKey: string): string[] {
  if (!normalizedKey) {
    return [];
  }
  const parts = normalizedKey.match(/[a-z]{3,}|\d{4,}/g) ?? [];
  return [...new Set(parts)];
}

function tokenOverlapCount(left: string, right: string): number {
  const leftTokens = extractMatchTokens(left);
  const rightTokens = extractMatchTokens(right);
  let hits = 0;
  for (const leftToken of leftTokens) {
    for (const rightToken of rightTokens) {
      if (leftToken === rightToken || leftToken.includes(rightToken) || rightToken.includes(leftToken)) {
        hits += 1;
      }
    }
  }
  return hits;
}

function inferDocumentTypeFromReference(reference: string): string | undefined {
  const normalized = normalizeSearchText(reference);
  if (
    normalized.includes('sicherheitsdatenblatt')
    || /\bsdb\b/.test(normalized)
    || normalized.includes('safety data sheet')
    || /\bmsds\b/.test(normalized)
    || /\bsds\b/.test(normalized)
  ) {
    return 'safety_data_sheet';
  }
  if (/\brohs\b/.test(normalized)) {
    return 'rohs_confirmation';
  }
  if (normalized.includes('regulatorisches') || /\brds\b/.test(normalized)) {
    return 'regulatory_data_sheet';
  }
  return undefined;
}

function findUniqueComplianceDocumentByType(
  docs: readonly ComplianceSourceDocument[],
  type: string,
): ComplianceSourceDocument | undefined {
  const matches = docs.filter((doc) => doc.type === type);
  return matches.length === 1 ? matches[0] : undefined;
}

const AUDIT_FIELD_DOC_TYPE_HINTS: Readonly<Record<string, readonly string[]>> = {
  hStatements: ['safety_data_sheet'],
  pStatements: ['safety_data_sheet'],
  ghsSymbols: ['safety_data_sheet'],
  substancesOfConcern: ['safety_data_sheet'],
  chemicalComposition: ['safety_data_sheet'],
  materialComposition: ['safety_data_sheet', 'regulatory_data_sheet'],
  upi: ['safety_data_sheet'],
  ufi: ['safety_data_sheet'],
  hersteller: ['regulatory_data_sheet', 'safety_data_sheet', 'compliance_pdf'],
  modellname: ['regulatory_data_sheet', 'safety_data_sheet', 'compliance_pdf'],
  gtin: ['regulatory_data_sheet', 'safety_data_sheet', 'compliance_pdf'],
  sku: ['regulatory_data_sheet', 'safety_data_sheet', 'compliance_pdf'],
  ewcCode: ['regulatory_data_sheet', 'safety_data_sheet', 'compliance_pdf'],
  wasteCode: ['regulatory_data_sheet', 'safety_data_sheet', 'compliance_pdf'],
};

function resolveFieldHintDocument(
  fieldName: string | undefined,
  docs: readonly ComplianceSourceDocument[],
): ComplianceSourceDocument | undefined {
  if (!fieldName) {
    return undefined;
  }
  const preferredTypes = AUDIT_FIELD_DOC_TYPE_HINTS[fieldName];
  if (!preferredTypes) {
    return undefined;
  }
  for (const type of preferredTypes) {
    const unique = findUniqueComplianceDocumentByType(docs, type);
    if (unique) {
      return unique;
    }
  }
  return undefined;
}

function scoreComplianceDocumentMatch(
  fileStemKey: string,
  fileFullKey: string,
  doc: ComplianceSourceDocument,
): number {
  const titleKey = normalizeDocumentMatchKey(doc.title);
  const urlBase = stripStorageUuidPrefix(basenameFromDocumentUrl(doc.url));
  const urlStemKey = normalizeDocumentMatchKey(urlBase.replace(/\.[^.]+$/i, ''));
  const urlFullKey = normalizeDocumentMatchKey(urlBase);

  if (fileStemKey === titleKey || fileFullKey === titleKey) {
    return 100;
  }
  if (fileStemKey === urlStemKey || fileFullKey === urlFullKey || fileStemKey === urlFullKey) {
    return 95;
  }

  let score = 0;
  if (keysOverlap(fileStemKey, titleKey) || keysOverlap(fileFullKey, titleKey)) {
    score = Math.max(score, 80);
  }
  if (
    keysOverlap(fileStemKey, urlStemKey)
    || keysOverlap(fileFullKey, urlFullKey)
    || keysOverlap(fileStemKey, urlFullKey)
  ) {
    score = Math.max(score, 85);
  }

  score = Math.max(score, tokenOverlapCount(fileStemKey, urlStemKey) * 20);
  score = Math.max(score, tokenOverlapCount(fileStemKey, titleKey) * 15);

  if (
    doc.type === 'safety_data_sheet'
    && inferDocumentTypeFromReference(fileStemKey) === 'safety_data_sheet'
  ) {
    score = Math.max(score, 70);
  }

  return score;
}

export type MatchComplianceDocumentOptions = {
  readonly fieldName?: string;
};

/**
 * Findet das Compliance-PDF zu einem RAG-`source.fileName` (Titel, URL-Basename, SDB-Typ, Feld-Hint).
 */
export function matchComplianceDocumentByFileName(
  fileName: string,
  docs: readonly ComplianceSourceDocument[],
  options?: MatchComplianceDocumentOptions,
): ComplianceSourceDocument | undefined {
  const trimmed = fileName.trim();
  if (docs.length === 0) {
    return undefined;
  }

  if (!trimmed || trimmed === 'unknown') {
    return resolveFieldHintDocument(options?.fieldName, docs);
  }

  const fileStemKey = normalizeDocumentMatchKey(trimmed.replace(/\.[^.]+$/i, ''));
  const fileFullKey = normalizeDocumentMatchKey(trimmed);

  let bestDoc: ComplianceSourceDocument | undefined;
  let bestScore = 0;
  for (const doc of docs) {
    const score = scoreComplianceDocumentMatch(fileStemKey, fileFullKey, doc);
    if (score > bestScore) {
      bestScore = score;
      bestDoc = doc;
    }
  }

  if (bestDoc && bestScore >= 20) {
    return bestDoc;
  }

  const inferredType = inferDocumentTypeFromReference(trimmed);
  if (inferredType) {
    const uniqueByType = findUniqueComplianceDocumentByType(docs, inferredType);
    if (uniqueByType) {
      return uniqueByType;
    }
  }

  const fieldHintDoc = resolveFieldHintDocument(options?.fieldName, docs);
  if (fieldHintDoc) {
    return fieldHintDoc;
  }

  const uniqueSdb = findUniqueComplianceDocumentByType(docs, 'safety_data_sheet');
  if (
    uniqueSdb
    && (
      inferredType === 'safety_data_sheet'
      || /sdb|sicherheitsdatenblatt|safety|msds|sds/i.test(trimmed)
    )
  ) {
    return uniqueSdb;
  }

  return bestScore > 0 ? bestDoc : undefined;
}

/** Vereinigt alle bekannten Attachment-Container aus dem Pass (ohne Duplikate). */
export function collectComplianceSourceDocuments(
  ...sources: readonly unknown[]
): ComplianceSourceDocument[] {
  const merged: ComplianceSourceDocument[] = [];
  for (const source of sources) {
    merged.push(...parseComplianceSourceDocuments(source));
  }
  return dedupeComplianceSourceDocuments(merged);
}

export function dedupeComplianceSourceDocuments(
  docs: readonly ComplianceSourceDocument[],
): ComplianceSourceDocument[] {
  const seen = new Set<string>();
  const out: ComplianceSourceDocument[] = [];
  for (const doc of docs) {
    if (seen.has(doc.url)) {
      continue;
    }
    seen.add(doc.url);
    out.push(doc);
  }
  return out;
}

/**
 * Hängt ein Dokument an `extracted_attributes.sourceDocuments` an (kein Überschreiben).
 */
export function appendSourceDocumentToExtractedAttributes(
  existingJson: unknown,
  document: ComplianceSourceDocument,
): Record<string, unknown> {
  const base =
    typeof existingJson === 'object' && existingJson !== null && !Array.isArray(existingJson)
      ? { ...(existingJson as Record<string, unknown>) }
      : {};

  const prior = parseComplianceSourceDocuments(base.sourceDocuments);
  const next = dedupeComplianceSourceDocuments([...prior, document]);
  return { ...base, sourceDocuments: next };
}
