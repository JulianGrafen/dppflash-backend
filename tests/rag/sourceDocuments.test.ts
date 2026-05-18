import { describe, expect, it } from 'vitest';
import {
  appendSourceDocumentToExtractedAttributes,
  dedupeComplianceSourceDocuments,
  inferComplianceDocumentType,
  parseComplianceSourceDocuments,
} from '@/app/domain/rag/sourceDocuments';

describe('sourceDocuments', () => {
  it('appends without overwriting prior entries', () => {
    const merged = appendSourceDocumentToExtractedAttributes(
      {
        hersteller: { value: 'ACME', sourcePdf: 'a.pdf', contextSnippet: 'x', confidence: 1 },
        sourceDocuments: [{ title: 'Alt', url: 'https://example.com/a.pdf', type: 'compliance_pdf' }],
      },
      { title: 'SDB', url: 'https://example.com/b.pdf', type: 'safety_data_sheet' },
    );
    const docs = parseComplianceSourceDocuments(merged.sourceDocuments);
    expect(docs).toHaveLength(2);
    expect(docs.map((d) => d.url)).toContain('https://example.com/a.pdf');
  });

  it('dedupes by url', () => {
    const docs = dedupeComplianceSourceDocuments([
      { title: 'A', url: 'https://x.com/1.pdf', type: 'compliance_pdf' },
      { title: 'B', url: 'https://x.com/1.pdf', type: 'compliance_pdf' },
    ]);
    expect(docs).toHaveLength(1);
  });

  it('infers SDS type from filename', () => {
    expect(inferComplianceDocumentType('Produkt-SDB-final.pdf')).toBe('safety_data_sheet');
    expect(inferComplianceDocumentType('Technisches_Merkblatt.pdf')).toBe('technical_brief');
  });
});
