import { describe, expect, it } from 'vitest';
import type { VectorChunkRecord } from '@/app/application/ports/rag/VectorStorePort';
import { InMemoryVectorStore } from '@/app/infrastructure/rag/InMemoryVectorStore';

function chunk(
  overrides: Partial<VectorChunkRecord> & Pick<VectorChunkRecord, 'id' | 'tenantId' | 'productId'>,
): VectorChunkRecord {
  return {
    fileName: 'x.pdf',
    pageNumber: 1,
    text: 'hello world',
    embedding: Array.from({ length: 1536 }, () => 0.01),
    tokens: ['hello', 'world'],
    ...overrides,
  };
}

describe('InMemoryVectorStore entity-scoped search', () => {
  it('prefers chunks for productEntityId when hits exist', async () => {
    const store = new InMemoryVectorStore();
    const emb = Array.from({ length: 1536 }, () => 0.01);
    await store.upsertChunks([
      chunk({ id: '1', tenantId: 't', productId: 'p-a', text: 'alpha beta', tokens: ['alpha', 'beta'], embedding: emb }),
      chunk({ id: '2', tenantId: 't', productId: 'p-b', text: 'gamma delta', tokens: ['gamma', 'delta'], embedding: emb }),
    ]);

    const qv = Array.from({ length: 1536 }, () => 0.01);
    const hits = await store.searchHybrid('t', 'gamma', qv, 5, { productEntityId: 'p-a' });
    const ids = hits.map((h) => h.id);
    expect(ids).toContain('1');
    expect(ids).not.toContain('2');
  });

  it('falls back to full tenant when scoped product has no chunks', async () => {
    const store = new InMemoryVectorStore();
    const emb = Array.from({ length: 1536 }, () => 0.01);
    await store.upsertChunks([
      chunk({ id: '1', tenantId: 't', productId: 'p-a', text: 'only a', tokens: ['only', 'a'], embedding: emb }),
    ]);

    const qv = Array.from({ length: 1536 }, () => 0.01);
    const hits = await store.searchHybrid('t', 'only', qv, 5, { productEntityId: 'missing-product' });
    expect(hits.some((h) => h.id === '1')).toBe(true);
  });
});
