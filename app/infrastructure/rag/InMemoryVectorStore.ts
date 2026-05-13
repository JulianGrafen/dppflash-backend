import type {
  HybridSearchHit,
  VectorChunkRecord,
  VectorStorePort,
} from '@/app/application/ports/rag/VectorStorePort';
import { rankChunksHybrid } from '@/app/domain/rag/hybridRankChunks';

/**
 * In-memory hybrid index for local/dev when Supabase is not configured.
 */
export class InMemoryVectorStore implements VectorStorePort {
  readonly name = 'InMemoryVectorStore';

  private readonly store = new Map<string, VectorChunkRecord>();

  async upsertChunks(chunks: readonly VectorChunkRecord[]): Promise<void> {
    for (const chunk of chunks) {
      this.store.set(chunk.id, chunk);
    }
  }

  async getStatsForTenant(tenantId: string): Promise<{
    readonly chunkCount: number;
    readonly distinctFileNames: readonly string[];
  }> {
    const list = [...this.store.values()].filter((c) => c.tenantId === tenantId);
    const names = new Set(list.map((c) => c.fileName));
    return {
      chunkCount: list.length,
      distinctFileNames: [...names].sort((a, b) => a.localeCompare(b)),
    };
  }

  async searchHybrid(
    tenantId: string,
    query: string,
    queryEmbedding: readonly number[],
    limit: number,
  ): Promise<readonly HybridSearchHit[]> {
    const candidates = [...this.store.values()].filter((c) => c.tenantId === tenantId);
    return rankChunksHybrid(candidates, query, queryEmbedding, limit);
  }
}
