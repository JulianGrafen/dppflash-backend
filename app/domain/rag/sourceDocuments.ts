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
