import { describe, expect, it } from 'vitest';
import {
  eagerExtractionResponseSchema,
  eagerExtractionResponseToRows,
} from '@/app/domain/rag/eagerExtractionResponseSchema';

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

  it('accepts gtin and allowed keys only', () => {
    const r = eagerExtractionResponseSchema.safeParse({
      gtin: { value: '4006381333931', sourcePdf: 'cat.pdf', contextSnippet: 'EAN' },
      chemicalComposition: { value: 'H2O', sourcePdf: 'sds.pdf', contextSnippet: 'Abschnitt 3' },
    });
    expect(r.success).toBe(true);
  });

  it('rejects extra inner keys (strict field object)', () => {
    const r = eagerExtractionResponseSchema.safeParse({
      gtin: { value: '1', sourcePdf: 'a.pdf', contextSnippet: 'x', confidence: 0.9 },
    });
    expect(r.success).toBe(false);
  });

  it('accepts endOfLifeInstructions with value null (key present)', () => {
    const r = eagerExtractionResponseSchema.safeParse({
      endOfLifeInstructions: { value: null, sourcePdf: 'sds.pdf', contextSnippet: '—' },
    });
    expect(r.success).toBe(true);
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
