import { describe, expect, it } from 'vitest';
import { rankChunksHybrid } from '@/app/domain/rag/hybridRankChunks';
import type { VectorChunkRecord } from '@/app/application/ports/rag/VectorStorePort';

describe('rankChunksHybrid', () => {
  it('ranks chunk that matches query text higher', () => {
    const a: VectorChunkRecord = {
      id: '1',
      tenantId: 't',
      fileName: 'x.pdf',
      pageNumber: 1,
      text: 'GTIN 5901234123457 Cimsec Produkt',
      embedding: Array.from({ length: 1536 }, () => 0.01),
      tokens: ['gtin', '5901234123457', 'cimsec', 'produkt'],
    };
    const b: VectorChunkRecord = {
      id: '2',
      tenantId: 't',
      fileName: 'y.pdf',
      pageNumber: 1,
      text: 'unrelated boilerplate',
      embedding: Array.from({ length: 1536 }, () => 0.02),
      tokens: ['unrelated', 'boilerplate'],
    };

    const hits = rankChunksHybrid([a, b], 'Cimsec GTIN', Array.from({ length: 1536 }, () => 0.015), 2);
    expect(hits[0]?.id).toBe('1');
  });
});
