/**
 * Compliance-PDF-Metadaten in `products.extracted_attributes.sourceDocuments`.
 */

export type ComplianceSourceDocument = {
  readonly title: string;
  readonly url: string;
  readonly type: string;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function inferComplianceDocumentType(fileName: string): string {
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
  if (
    lower.includes('merkblatt')
    || lower.includes('technisch')
    || lower.includes('technical')
    || lower.includes('tds')
  ) {
    return 'technical_brief';
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
