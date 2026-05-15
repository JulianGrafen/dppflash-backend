import { describe, expect, it } from 'vitest';
import {
  coerceLegacyChemicalCompositionValue,
  eagerExtractionResponseSchema,
  eagerExtractionResponseToRows,
  normalizeEagerExtractionRawObject,
} from '@/app/domain/rag/eagerExtractionResponseSchema';

const sampleRow = {
  stoffname: 'Quarz (SiO2)',
  casNummer: '14808-60-7',
  prozentAnteil: '40–60 %',
  einstufung: 'STOT SE 3, H335',
};

describe('coerceLegacyChemicalCompositionValue', () => {
  it('wraps non-empty strings as single SDS row', () => {
    expect(coerceLegacyChemicalCompositionValue('  X  ')).toEqual([
      { stoffname: 'X', casNummer: null, prozentAnteil: '', einstufung: null },
    ]);
  });

  it('returns null for blank string', () => {
    expect(coerceLegacyChemicalCompositionValue('   ')).toBeNull();
  });
});

describe('normalizeEagerExtractionRawObject', () => {
  it('maps materialZusammensetzung to chemicalComposition as structured rows', () => {
    const n = normalizeEagerExtractionRawObject({
      materialZusammensetzung: { value: 'Quarz', sourcePdf: 'b.pdf', contextSnippet: 'Abschnitt 3' },
    });
    expect(n).toEqual({
      chemicalComposition: {
        value: [{ stoffname: 'Quarz', casNummer: null, prozentAnteil: '', einstufung: null }],
        sourcePdf: 'b.pdf',
        contextSnippet: 'Abschnitt 3',
      },
    });
  });

  it('maps manufacturer to hersteller', () => {
    const n = normalizeEagerExtractionRawObject({
      manufacturer: { value: 'Henkel', sourcePdf: 'sdb.pdf', contextSnippet: 'Firma' },
    });
    expect(n.hersteller).toMatchObject({ value: 'Henkel', sourcePdf: 'sdb.pdf' });
  });

  it('drops unknown top-level keys', () => {
    const n = normalizeEagerExtractionRawObject({
      fooBar: { value: 'x', sourcePdf: 'a.pdf', contextSnippet: 'y' },
    });
    expect(Object.keys(n)).toHaveLength(0);
  });

  it('prefers richer composition when two keys collapse to chemicalComposition', () => {
    const n = normalizeEagerExtractionRawObject({
      materialComposition: {
        value: [{ ...sampleRow, stoffname: 'A' }],
        sourcePdf: '1.pdf',
        contextSnippet: 'x',
      },
      chemicalComposition: {
        value: [
          sampleRow,
          {
            stoffname: 'Zement',
            casNummer: null,
            prozentAnteil: '10 %',
            einstufung: null,
          },
        ],
        sourcePdf: '2.pdf',
        contextSnippet: 'y',
      },
    });
    expect((n.chemicalComposition as { value: unknown }).value).toEqual([
      sampleRow,
      { stoffname: 'Zement', casNummer: null, prozentAnteil: '10 %', einstufung: null },
    ]);
  });

  it('prefers longer legacy string when two keys collapse to chemicalComposition', () => {
    const n = normalizeEagerExtractionRawObject({
      materialComposition: { value: 'A', sourcePdf: '1.pdf', contextSnippet: 'x' },
      chemicalComposition: { value: 'AAA', sourcePdf: '2.pdf', contextSnippet: 'y' },
    });
    expect((n.chemicalComposition as { value: unknown }).value).toEqual([
      { stoffname: 'AAA', casNummer: null, prozentAnteil: '', einstufung: null },
    ]);
  });
});

describe('eagerExtractionResponseSchema', () => {
  it('accepts empty object (all keys optional)', () => {
    const r = eagerExtractionResponseSchema.safeParse({});
    expect(r.success).toBe(true);
  });

  it('rejects unknown top-level keys (strict)', () => {
    const r = eagerExtractionResponseSchema.safeParse({
      chemicalComposition: { value: [sampleRow], sourcePdf: 'a.pdf', contextSnippet: 'c' },
      materialZusammensetzung: { value: 'y', sourcePdf: 'a.pdf', contextSnippet: 'd' },
    });
    expect(r.success).toBe(false);
  });

  it('accepts productName and gtin after normalization', () => {
    const raw = normalizeEagerExtractionRawObject({
      produktname: { value: 'Cimsec', sourcePdf: 'a.pdf', contextSnippet: 't' },
      gtin: { value: '9000101122954', sourcePdf: 'a.pdf', contextSnippet: 'EAN' },
    });
    const r = eagerExtractionResponseSchema.safeParse(raw);
    expect(r.success).toBe(true);
  });

  it('accepts chemicalComposition with SDS row array', () => {
    const r = eagerExtractionResponseSchema.safeParse({
      chemicalComposition: { value: [sampleRow], sourcePdf: 's.pdf', contextSnippet: '§3' },
    });
    expect(r.success).toBe(true);
  });

  it('rejects chemicalComposition flat string value', () => {
    const r = eagerExtractionResponseSchema.safeParse({
      chemicalComposition: { value: 'Quarz, Zement', sourcePdf: 'a.pdf', contextSnippet: 'x' },
    });
    expect(r.success).toBe(false);
  });

  it('rejects extra inner keys (strict field object)', () => {
    const r = eagerExtractionResponseSchema.safeParse({
      gtin: { value: '1', sourcePdf: 'a.pdf', contextSnippet: 'x', confidence: 0.9 },
    });
    expect(r.success).toBe(false);
  });
});

describe('eagerExtractionResponseToRows', () => {
  it('fills default sourcePdf from file name', () => {
    const data = eagerExtractionResponseSchema.parse({
      modellname: { value: 'M', sourcePdf: '', contextSnippet: 'ctx' },
    });
    const rows = eagerExtractionResponseToRows(data, 'default.pdf');
    expect(rows.modellname?.sourcePdf).toBe('default.pdf');
  });

  it('drops keys with null or empty value before merge', () => {
    const data = eagerExtractionResponseSchema.parse({
      gtin: { value: null, sourcePdf: 'a.pdf', contextSnippet: 'x' },
      modellname: { value: '   ', sourcePdf: 'a.pdf', contextSnippet: 'y' },
    });
    const rows = eagerExtractionResponseToRows(data, 'f.pdf');
    expect(Object.keys(rows)).toHaveLength(0);
  });

  it('keeps chemicalComposition when array non-empty', () => {
    const data = eagerExtractionResponseSchema.parse({
      chemicalComposition: { value: [sampleRow], sourcePdf: 's.pdf', contextSnippet: 'Abschnitt 3' },
    });
    const rows = eagerExtractionResponseToRows(data, 'f.pdf');
    expect(rows.chemicalComposition?.value).toEqual([sampleRow]);
  });

  it('drops chemicalComposition when value null', () => {
    const data = eagerExtractionResponseSchema.parse({
      chemicalComposition: { value: null, sourcePdf: 's.pdf', contextSnippet: 'x' },
    });
    const rows = eagerExtractionResponseToRows(data, 'f.pdf');
    expect(rows.chemicalComposition).toBeUndefined();
  });
});

describe('eager pipeline: normalize then strict parse', () => {
  it('accepts LLM-style German keys after normalize', () => {
    const raw = {
      materialZusammensetzung: {
        value: [{ ...sampleRow, prozentAnteil: '≥ 99 %' }],
        sourcePdf: 'SDB.pdf',
        contextSnippet: 'Zusammensetzung',
      },
      manufacturer: { value: 'Henkel AG', sourcePdf: 'SDB.pdf', contextSnippet: 'Hersteller' },
    };
    const n = normalizeEagerExtractionRawObject(raw as Record<string, unknown>);
    const r = eagerExtractionResponseSchema.safeParse(n);
    expect(r.success).toBe(true);
  });
});
