import { describe, expect, it } from 'vitest';
import {
  extractedAttributesToAuditTrailFields,
  mergeExtractedAttributesJsonForPersistence,
  pickProductEntityAnchorFromExtracted,
} from '@/app/domain/rag/extractedAttributesJson';

describe('pickProductEntityAnchorFromExtracted', () => {
  it('prefers productName then modellname over filename fallback', () => {
    const anchor = pickProductEntityAnchorFromExtracted(
      {
        modellname: {
          value: 'Cimsec S1 Flex Schnell',
          sourcePdf: 'sdb.pdf',
          contextSnippet: 'x',
          confidence: 0.9,
        },
        gtin: { value: '123', sourcePdf: 'a.pdf', contextSnippet: 'y', confidence: 0.9 },
      },
      'SDB-Cimsec-filename',
    );
    expect(anchor).toBe('Cimsec S1 Flex Schnell');
  });
});

describe('mergeExtractedAttributesJsonForPersistence', () => {
  it('keeps existing top-level keys not present in incoming', () => {
    const existing = {
      gtin: { value: '123', sourcePdf: 'a.pdf', contextSnippet: 'x', confidence: 0.9 },
      hersteller: { value: 'OldCo', sourcePdf: 'a.pdf', contextSnippet: 'y', confidence: 0.8 },
    };
    const incoming = {
      modellname: {
        value: 'M1',
        sourcePdf: 'b.pdf',
        contextSnippet: 'z',
        confidence: 0.85,
      },
    };
    const merged = mergeExtractedAttributesJsonForPersistence(existing, incoming);
    expect(merged.gtin).toEqual(existing.gtin);
    expect(merged.hersteller).toEqual(existing.hersteller);
    expect(merged.modellname).toMatchObject(incoming.modellname);
  });

  it('does not overwrite existing with incoming null or empty value', () => {
    const existing = {
      gtin: { value: '111', sourcePdf: 'a.pdf', contextSnippet: 'x', confidence: 0.95 },
    };
    const incoming = {
      gtin: { value: '999', sourcePdf: 'b.pdf', contextSnippet: 'y', confidence: 0.3 },
    };
    const mergedWeak = mergeExtractedAttributesJsonForPersistence(existing, {
      gtin: { ...incoming.gtin, value: null },
    });
    expect(mergedWeak.gtin).toEqual(existing.gtin);

    const mergedEmpty = mergeExtractedAttributesJsonForPersistence(existing, {
      gtin: { ...incoming.gtin, value: '' },
    });
    expect(mergedEmpty.gtin).toEqual(existing.gtin);

    const mergedWhitespace = mergeExtractedAttributesJsonForPersistence(existing, {
      gtin: { ...incoming.gtin, value: '   ' },
    });
    expect(mergedWhitespace.gtin).toEqual(existing.gtin);
  });

  it('simulates Doc B then Doc A: archive fields stay when Doc A adds gtin', () => {
    const afterDocB = {
      chemicalComposition: {
        value: 'Quarz, Zement',
        sourcePdf: 'SDB-Cimsec.pdf',
        contextSnippet: 'Zusammensetzung',
        confidence: 0.9,
      },
      hersteller: {
        value: 'Henkel AG',
        sourcePdf: 'SDB-Cimsec.pdf',
        contextSnippet: 'Hersteller',
        confidence: 0.9,
      },
    };
    const docAIncoming = {
      gtin: {
        value: '9000101122954',
        sourcePdf: 'Produktinformationen.pdf',
        contextSnippet: 'GTIN',
        confidence: 0.88,
      },
      productName: {
        value: 'Cimsec Fliesen Kleber',
        sourcePdf: 'Produktinformationen.pdf',
        contextSnippet: 'Name',
        confidence: 0.88,
      },
    };
    const merged = mergeExtractedAttributesJsonForPersistence(afterDocB, docAIncoming);
    expect(merged.chemicalComposition).toEqual(afterDocB.chemicalComposition);
    expect(merged.hersteller).toEqual(afterDocB.hersteller);
    expect((merged.gtin as { value: string }).value).toBe('9000101122954');
    expect(Object.keys(merged).sort()).toEqual(
      ['chemicalComposition', 'gtin', 'hersteller', 'productName'].sort(),
    );
  });

  it('overwrites when incoming has a non-empty value', () => {
    const existing = {
      gtin: { value: '111', sourcePdf: 'a.pdf', contextSnippet: 'x', confidence: 0.5 },
    };
    const incoming = {
      gtin: { value: '222', sourcePdf: 'b.pdf', contextSnippet: 'y', confidence: 0.5 },
    };
    const merged = mergeExtractedAttributesJsonForPersistence(existing, incoming);
    expect((merged.gtin as { value: string }).value).toBe('222');
  });

  it('protects richer Merkblatt row: keeps longer handlingAndApplicationInstructions text', () => {
    const existing = {
      handlingAndApplicationInstructions: {
        value:
          'Detaillierte Verarbeitungsvorgaben über mehrere Absätze inklusive Normbezug DIN EN sowie Schutzmaßnahmen und Arbeitsabstand.',
        sourcePdf: 'merk.pdf',
        contextSnippet: 'Verarbeitungs-HINWEISE',
        confidence: 0.92,
      },
    };
    const incoming = {
      handlingAndApplicationInstructions: {
        value: 'Kurz merken: Handschuhe tragen; Werkzeug nach Gebrauch reinigen.',
        sourcePdf: 'docB.pdf',
        contextSnippet: 'Hinweise',
        confidence: 0.88,
      },
    };
    const merged = mergeExtractedAttributesJsonForPersistence(existing, incoming);
    expect((merged.handlingAndApplicationInstructions as { value: string }).value).toBe(
      existing.handlingAndApplicationInstructions.value,
    );
  });

  it('may upgrade shorter handling row when incoming excerpt is materially longer', () => {
    const existing = {
      handlingAndApplicationInstructions: {
        value: 'Kurz',
        sourcePdf: 'alt.pdf',
        contextSnippet: 'x',
        confidence: 0.9,
      },
    };
    const incoming = {
      handlingAndApplicationInstructions: {
        value: 'Nach Gebrauch Werkzeug sofort mehrfach unter fließendem Wasser abspülen und trocknen; Flecken sofort entsorgen.',
        sourcePdf: 'neu.pdf',
        contextSnippet: 'Ausführliche Reinigung',
        confidence: 0.91,
      },
    };
    const merged = mergeExtractedAttributesJsonForPersistence(existing, incoming);
    expect((merged.handlingAndApplicationInstructions as { value: string }).value).toBe(
      incoming.handlingAndApplicationInstructions.value,
    );
  });
});

describe('extractedAttributesToAuditTrailFields', () => {
  it('matches manufacturer key when gap asks for hersteller', () => {
    const stored = {
      manufacturer: {
        value: 'ACME GmbH',
        sourcePdf: 'doc.pdf',
        contextSnippet: 'Hersteller ACME GmbH',
        confidence: 0.9,
      },
    };
    const { fields, keyResolution } = extractedAttributesToAuditTrailFields(stored, ['hersteller']);
    expect(fields.hersteller?.value).toBe('ACME GmbH');
    expect(fields.hersteller?.source.fileName).toBe('doc.pdf');
    expect(keyResolution).toEqual([{ missingField: 'hersteller', usedStoredKey: 'manufacturer' }]);
  });

  it('is case-insensitive on JSON keys', () => {
    const stored = {
      Hersteller: {
        value: 'X',
        sourcePdf: 'a.pdf',
        contextSnippet: 'ctx',
        confidence: 0.8,
      },
    };
    const { fields } = extractedAttributesToAuditTrailFields(stored, ['hersteller']);
    expect(fields.hersteller?.value).toBe('X');
  });

  it('maps modellname gap to productName in stored JSON', () => {
    const stored = {
      productName: {
        value: 'Cimsec Handelsname',
        sourcePdf: 'a.pdf',
        contextSnippet: 'Produkt',
        confidence: 0.9,
      },
    };
    const { fields, keyResolution } = extractedAttributesToAuditTrailFields(stored, ['modellname']);
    expect(fields.modellname?.value).toBe('Cimsec Handelsname');
    expect(keyResolution[0]?.usedStoredKey).toBe('productName');
  });

  it('maps ewcCode gap to wasteCode in JSON', () => {
    const stored = {
      wasteCode: {
        value: '17 02 03',
        sourcePdf: 'sds.pdf',
        contextSnippet: 'EWC 17 02 03',
        confidence: 0.7,
      },
    };
    const { fields, keyResolution } = extractedAttributesToAuditTrailFields(stored, ['ewcCode']);
    expect(fields.ewcCode?.value).toBe('17 02 03');
    expect(keyResolution[0]?.usedStoredKey).toBe('wasteCode');
  });

  it('maps zusammensetzung gap to chemicalComposition in stored JSON', () => {
    const stored = {
      chemicalComposition: {
        value: 'Quarz; Zement',
        sourcePdf: 'sdb.pdf',
        contextSnippet: 'Abschnitt 3',
        confidence: 0.85,
      },
    };
    const { fields, keyResolution } = extractedAttributesToAuditTrailFields(stored, ['zusammensetzung']);
    expect(fields.zusammensetzung?.value).toBe('Quarz; Zement');
    expect(keyResolution[0]?.usedStoredKey).toBe('chemicalComposition');
  });

  it('does not flag flat H-code lists for manual review when snippet is short', () => {
    const stored = {
      hStatements: {
        value: ['H315', 'H317'],
        sourcePdf: 'sdb.pdf',
        contextSnippet: 'x',
        confidence: 0.9,
      },
    };
    const { fields } = extractedAttributesToAuditTrailFields(stored, ['hStatements']);
    expect(fields.hStatements?.value).toEqual(['H315', 'H317']);
    expect(fields.hStatements?.requiresManualReview).toBe(false);
  });

  it('maps pStatements/substancesOfConcern via synonyms from stored JSON arrays', () => {
    const stored = {
      precautionaryStatements: {
        value: ['P102', 'P280'],
        sourcePdf: 'sdb.pdf',
        contextSnippet: 'Abschnitt 2',
        confidence: 0.81,
      },
      svhc: {
        value: ['Lead compounds (SVHC)'],
        sourcePdf: 'sdb.pdf',
        contextSnippet: 'Abschnitt 15',
        confidence: 0.8,
      },
    };
    const { fields, keyResolution } = extractedAttributesToAuditTrailFields(stored, [
      'pStatements',
      'substancesOfConcern',
    ]);
    expect(fields.pStatements?.value).toEqual(['P102', 'P280']);
    expect(fields.substancesOfConcern?.value).toEqual(['Lead compounds (SVHC)']);
    expect(keyResolution).toEqual([
      { missingField: 'pStatements', usedStoredKey: 'precautionaryStatements' },
      { missingField: 'substancesOfConcern', usedStoredKey: 'svhc' },
    ]);
  });
});
