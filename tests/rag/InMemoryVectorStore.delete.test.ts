import { describe, expect, it } from 'vitest';
import type { VectorChunkRecord } from '@/app/application/ports/rag/VectorStorePort';
import { InMemoryVectorStore } from '@/app/infrastructure/rag/InMemoryVectorStore';

function makeChunk(overrides: Partial<VectorChunkRecord> & Pick<VectorChunkRecord, 'id' | 'tenantId'>): VectorChunkRecord {
  return {
    fileName: 'x.pdf',
    pageNumber: 1,
    text: 't',
    embedding: Array.from({ length: 1536 }, () => 0),
    tokens: ['t'],
    ...overrides,
  };
}

describe('InMemoryVectorStore.deleteAllChunks', () => {
  it('removes only chunks for the given tenant', async () => {
    const store = new InMemoryVectorStore();
    await store.upsertChunks([
      makeChunk({ id: '1', tenantId: 'tenant-a' }),
      makeChunk({ id: '2', tenantId: 'tenant-b' }),
    ]);

    const { deletedCount } = await store.deleteAllChunks({ tenantId: 'tenant-a' });
    expect(deletedCount).toBe(1);

    const statsA = await store.getStatsForTenant('tenant-a');
    const statsB = await store.getStatsForTenant('tenant-b');
    expect(statsA.chunkCount).toBe(0);
    expect(statsB.chunkCount).toBe(1);
  });

  it('clears the entire index when no tenant filter is passed', async () => {
    const store = new InMemoryVectorStore();
    await store.upsertChunks([
      makeChunk({ id: '1', tenantId: 'tenant-a' }),
      makeChunk({ id: '2', tenantId: 'tenant-b' }),
    ]);

    const { deletedCount } = await store.deleteAllChunks();
    expect(deletedCount).toBe(2);

    expect((await store.getStatsForTenant('tenant-a')).chunkCount).toBe(0);
    expect((await store.getStatsForTenant('tenant-b')).chunkCount).toBe(0);
  });
});
