import { describe, expect, it } from 'vitest';
import {
  appendSourceDocumentToExtractedAttributes,
  classifyComplianceDocument,
  collectComplianceSourceDocuments,
  dedupeComplianceSourceDocuments,
  inferComplianceDocumentType,
  matchComplianceDocumentByFileName,
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
    ).toMatchObject({ type: 'technical_brief', title: 'Technisches Merkblatt' });
  });

  it('infers SDS type from filename but not technical product data sheets', () => {
    expect(inferComplianceDocumentType('Produkt-SDB-final.pdf')).toBe('safety_data_sheet');
    expect(inferComplianceDocumentType('Technisches_Merkblatt.pdf')).toBe('technical_brief');
    expect(inferComplianceDocumentType('Produktdatenblatt_ABC.pdf')).toBe('technical_brief');
    expect(inferComplianceDocumentType('RoHS_Confirmation.pdf')).toBe('rohs_confirmation');
  });

  it('matches RAG source file names to compliance storage URLs', () => {
    const docs = [
      {
        title: 'Sicherheitsdatenblatt',
        url: 'https://cdn.example.com/p1/uuid-SDB_Cimsec.pdf',
        type: 'safety_data_sheet',
      },
      {
        title: 'Technisches Merkblatt',
        url: 'https://cdn.example.com/p1/uuid-Merkblatt.pdf',
        type: 'compliance_pdf',
      },
    ];

    expect(matchComplianceDocumentByFileName('SDB-Cimsec.pdf', docs)?.title).toBe('Sicherheitsdatenblatt');
    expect(matchComplianceDocumentByFileName('Merkblatt.pdf', docs)?.title).toBe('Technisches Merkblatt');
  });

  it('matches SDB audit fields to the single safety data sheet by field hint', () => {
    const docs = [
      {
        title: 'Sicherheitsdatenblatt',
        url: 'https://cdn.example.com/p1/uuid-000000670689_SDB_UA_DE.pdf',
        type: 'safety_data_sheet',
      },
      {
        title: 'Regulatorisches Datenblatt',
        url: 'https://cdn.example.com/p1/uuid-000000670689_RDS_UA_DE.pdf',
        type: 'regulatory_data_sheet',
      },
    ];

    expect(
      matchComplianceDocumentByFileName('chunk-ref.pdf', docs, { fieldName: 'hStatements' })?.title,
    ).toBe('Sicherheitsdatenblatt');
    expect(
      matchComplianceDocumentByFileName('_000000670689_RDS_UA_DE.PDF', docs, { fieldName: 'hersteller' })?.title,
    ).toBe('Regulatorisches Datenblatt');
  });

  it('matches numeric SDB filenames against storage basenames', () => {
    const docs = [
      {
        title: 'Sicherheitsdatenblatt',
        url: 'https://cdn.example.com/p1/8b1e2f3a-1111-2222-3333-444444444444-_000000670689_SDB_UA_DE.pdf',
        type: 'safety_data_sheet',
      },
    ];

    expect(
      matchComplianceDocumentByFileName('_000000670689_SDB_UA_DE.PDF', docs)?.title,
    ).toBe('Sicherheitsdatenblatt');
  });

  it('collects documents from multiple attachment containers', () => {
    const docs = collectComplianceSourceDocuments(
      [{ title: 'A', url: 'https://x.com/1.pdf', type: 'compliance_pdf' }],
      undefined,
      [{ title: 'SDB', url: 'https://x.com/2.pdf', type: 'safety_data_sheet' }],
    );
    expect(docs).toHaveLength(2);
  });
});
