import { describe, expect, it } from 'vitest';
import {
  eagerExtractionResponseSchema,
  eagerExtractionResponseToRows,
  normalizeEagerExtractionRawObject,
} from '@/app/domain/rag/eagerExtractionResponseSchema';

describe('normalizeEagerExtractionRawObject', () => {
  it('maps materialZusammensetzung to chemicalComposition', () => {
    const n = normalizeEagerExtractionRawObject({
      materialZusammensetzung: { value: 'Quarz', sourcePdf: 'b.pdf', contextSnippet: 'Abschnitt 3' },
    });
    expect(n).toEqual({
      chemicalComposition: { value: 'Quarz', sourcePdf: 'b.pdf', contextSnippet: 'Abschnitt 3' },
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

  it('prefers longer value when two keys collapse to chemicalComposition', () => {
    const n = normalizeEagerExtractionRawObject({
      materialComposition: { value: 'A', sourcePdf: '1.pdf', contextSnippet: 'x' },
      chemicalComposition: { value: 'AAA', sourcePdf: '2.pdf', contextSnippet: 'y' },
    });
    expect((n.chemicalComposition as { value: string }).value).toBe('AAA');
  });
});

describe('eagerExtractionResponseSchema', () => {
  it('accepts empty object (all keys optional)', () => {
    const r = eagerExtractionResponseSchema.safeParse({});
    expect(r.success).toBe(true);
  });

  it('rejects unknown top-level keys (strict)', () => {
    const r = eagerExtractionResponseSchema.safeParse({
      chemicalComposition: { value: 'x', sourcePdf: 'a.pdf', contextSnippet: 'c' },
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
});

describe('eager pipeline: normalize then strict parse', () => {
  it('accepts LLM-style German keys after normalize', () => {
    const raw = {
      materialZusammensetzung: { value: 'Zement', sourcePdf: 'SDB.pdf', contextSnippet: 'Zusammensetzung' },
      manufacturer: { value: 'Henkel AG', sourcePdf: 'SDB.pdf', contextSnippet: 'Hersteller' },
    };
    const n = normalizeEagerExtractionRawObject(raw as Record<string, unknown>);
    const r = eagerExtractionResponseSchema.safeParse(n);
    expect(r.success).toBe(true);
  });
});
