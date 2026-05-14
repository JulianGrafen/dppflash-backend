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

  it('accepts only allowed keys', () => {
    const r = eagerExtractionResponseSchema.safeParse({
      chemicalComposition: { value: 'H2O', sourcePdf: 'sds.pdf', contextSnippet: 'Abschnitt 3' },
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
});
