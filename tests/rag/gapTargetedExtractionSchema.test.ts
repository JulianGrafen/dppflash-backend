import { describe, expect, it } from 'vitest';
import { buildGapLlmResponseSchema, gapLlmFieldSchema } from '@/app/domain/rag/gapTargetedExtractionSchema';

describe('gapTargetedExtractionSchema', () => {
  it('parses per-field rows with value, sourcePdf, contextSnippet', () => {
    const row = gapLlmFieldSchema.parse({
      value: ' 42 ',
      sourcePdf: 'doc.pdf',
      contextSnippet: 'x',
    });
    expect(row.value).toBe('42');
    expect(row.sourcePdf).toBe('doc.pdf');
  });

  it('coerces null-like strings to null', () => {
    const row = gapLlmFieldSchema.parse({
      value: 'null',
      sourcePdf: '',
      contextSnippet: '',
    });
    expect(row.value).toBeNull();
  });

  it('strict object shape for multiple keys', () => {
    const schema = buildGapLlmResponseSchema(['gtin', 'wasteCode']);
    const ok = schema.safeParse({
      gtin: { value: '1', sourcePdf: 'a', contextSnippet: '1' },
      wasteCode: { value: null, sourcePdf: '', contextSnippet: '' },
    });
    expect(ok.success).toBe(true);
  });
});
