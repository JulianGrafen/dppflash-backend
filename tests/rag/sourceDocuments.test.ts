import { describe, expect, it } from 'vitest';
import {
  appendSourceDocumentToExtractedAttributes,
  classifyComplianceDocument,
  collectComplianceSourceDocuments,
  dedupeComplianceSourceDocuments,
  enrichComplianceDocumentEntry,
  inferComplianceDocumentType,
  matchComplianceDocumentByFileName,
  parseComplianceSourceDocuments,
  resolveComplianceDocumentsForPassport,
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
        'RoHS_Confirmation.pdf',
        'Short directive reference only.',
      ),
    ).toMatchObject({ type: 'rohs_confirmation' });

    expect(
      classifyComplianceDocument(
        'datenblatt.pdf',
        'Regulatorisches Datenblatt\nProdukt: Test',
      ),
    ).toMatchObject({ type: 'regulatory_data_sheet', title: 'Regulatorisches Datenblatt' });
  });

  it('classifies Merkblatt from filename even when body text is sparse', () => {
    expect(
      classifyComplianceDocument(
        'Technisches_Merkblatt_Cimsec.pdf',
        'Produktname und Verarbeitung',
      ),
    ).toMatchObject({ type: 'technical_brief', title: 'Technisches Merkblatt' });
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
    expect(inferComplianceDocumentType('Technisches_Merkbaltt.pdf')).toBe('technical_brief');
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

  it('matches Merkblatt and RoHS filenames to typed compliance documents', () => {
    const docs = [
      {
        title: 'Alt',
        url: 'https://cdn.example.com/p1/uuid-Merkblatt.pdf',
        type: 'compliance_pdf',
      },
      {
        title: 'Alt',
        url: 'https://cdn.example.com/p1/uuid-RoHS_Confirmation.pdf',
        type: 'compliance_pdf',
      },
    ];

    expect(matchComplianceDocumentByFileName('Merkblatt.pdf', docs)?.url).toContain('Merkblatt.pdf');
    expect(matchComplianceDocumentByFileName('RoHS.pdf', docs)?.url).toContain('RoHS_Confirmation.pdf');
  });

  it('resolveComplianceDocumentsForPassport shows Merkblatt, RoHS and SDB from attachments', () => {
    const raw = {
      attachments: [
        {
          title: 'Upload',
          url: 'https://cdn.example.com/p1/uuid-SDB.pdf',
          type: 'safety_data_sheet',
        },
        {
          title: 'Upload',
          url: 'https://cdn.example.com/p1/uuid-Produktdatenblatt.pdf',
          type: 'compliance_pdf',
        },
        {
          title: 'Upload',
          url: 'https://cdn.example.com/p1/uuid-RoHS.pdf',
          type: 'compliance_pdf',
        },
      ],
      ragEnrichment: {
        success: true,
        auditTrail: {
          fields: {
            handlingInstructions: {
              value: 'Reinigung',
              source: { fileName: 'Produktdatenblatt.pdf', contextSnippet: 'Reinigung' },
            },
          },
        },
      },
    };

    const docs = resolveComplianceDocumentsForPassport(raw);
    expect(docs.map((doc) => doc.type).sort()).toEqual([
      'rohs_confirmation',
      'safety_data_sheet',
      'technical_brief',
    ]);
    expect(enrichComplianceDocumentEntry({
      title: 'Alt',
      url: 'https://cdn.example.com/p1/uuid-Produktdatenblatt.pdf',
      type: 'compliance_pdf',
    }).title).toBe('Technisches Merkblatt');
  });

  it('keeps fallback compliance PDFs in download list for preview matching', () => {
    const raw = {
      attachments: [
        {
          title: 'Technischer Anhang',
          url: 'https://cdn.example.com/p1/uuid-anhang-01.pdf',
          type: 'compliance_pdf',
        },
      ],
      ragEnrichment: {
        success: true,
        auditTrail: {
          fields: {
            hStatements: {
              value: ['H315'],
              source: { fileName: 'anhang-01.pdf', contextSnippet: 'H315', pageNumber: 2 },
              confidence: 0.8,
              requiresManualReview: false,
            },
          },
        },
      },
    };

    const docs = resolveComplianceDocumentsForPassport(raw);
    expect(docs).toHaveLength(1);
    expect(docs[0]?.url).toContain('anhang-01.pdf');
    expect(matchComplianceDocumentByFileName('anhang-01.pdf', docs)?.url).toContain('anhang-01.pdf');
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
