import { describe, expect, it } from 'vitest';
import { MatchDocumentChunksResponseSchema } from '@/app/infrastructure/supabase/matchDocumentChunks.types';

describe('MatchDocumentChunksResponseSchema', () => {
  it('parses a valid RPC row set', () => {
    const raw = [
      {
        chunk_id: '550e8400-e29b-41d4-a716-446655440000',
        document_id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        file_name: 'sds.pdf',
        content: 'GTIN 5901234123457',
        page_number: 2,
        similarity: 0.91,
      },
    ];

    const parsed = MatchDocumentChunksResponseSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data[0]?.similarity).toBeCloseTo(0.91);
    }
  });
});
