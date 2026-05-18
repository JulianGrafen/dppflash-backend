import { describe, expect, it } from 'vitest';
import {
  appendSourceDocumentToExtractedAttributes,
  classifyComplianceDocument,
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

  it('classifies RoHS confirmations and RDS documents as compliance documents', () => {
    expect(
      classifyComplianceDocument(
        'rohs.pdf',
        'RoHS Confirmation\nWe confirm compliance with Directive 2011/65/EU.',
      ),
    ).toMatchObject({ type: 'rohs_confirmation' });

    expect(
      classifyComplianceDocument(
        'datenblatt.pdf',
        'Regulatorisches Datenblatt\nProdukt: Test',
      ),
    ).toMatchObject({ type: 'regulatory_data_sheet', title: 'Regulatorisches Datenblatt' });
  });

  it('does not classify normal product data sheets as compliance documents', () => {
    expect(
      classifyComplianceDocument(
        'produktdaten.pdf',
        'Technisches Datenblatt\nProduktdaten\nVerarbeitung und Eigenschaften',
      ),
    ).toBeNull();
  });

  it('infers SDS type from filename but not technical product data sheets', () => {
    expect(inferComplianceDocumentType('Produkt-SDB-final.pdf')).toBe('safety_data_sheet');
    expect(inferComplianceDocumentType('Technisches_Merkblatt.pdf')).toBe('compliance_pdf');
  });
});
