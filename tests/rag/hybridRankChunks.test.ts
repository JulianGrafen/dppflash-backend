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

  it('boosts chunks that match product terms and the source PDF file name', () => {
    const emb = Array.from({ length: 1536 }, () => 0.01);
    const a: VectorChunkRecord = {
      id: '1',
      tenantId: 't',
      fileName: 'Cimsec-S1.pdf',
      pageNumber: 1,
      text: 'Allgemeine Hinweise',
      embedding: emb,
      tokens: ['allgemeine', 'hinweise'],
    };
    const b: VectorChunkRecord = {
      id: '2',
      tenantId: 't',
      fileName: 'other.pdf',
      pageNumber: 1,
      text: 'Cimsec Fliesen Kleber S1 Flex Schnell technische Daten',
      embedding: emb,
      tokens: ['cimsec', 'fliesen', 'kleber', 's1', 'flex', 'schnell', 'technische', 'daten'],
    };

    const termsOnly = rankChunksHybrid([a, b], 'Wartung', emb, 2, {
      productMatchTerms: ['cimsec', 'flex', 'schnell', 's1'],
    });
    expect(termsOnly[0]?.id).toBe('2');

    const withSameFile = rankChunksHybrid([a, b], 'Wartung', emb, 2, {
      productMatchTerms: ['cimsec', 'flex', 'schnell', 's1'],
      sourceFileName: 'Cimsec-S1.pdf',
    });
    expect(withSameFile[0]?.id).toBe('1');
  });
});
