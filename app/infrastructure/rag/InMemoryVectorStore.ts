import type {
  HybridSearchHit,
  HybridSearchOptions,
  VectorChunkRecord,
  VectorStorePort,
  RagChunkListOptions,
  RagChunkListResult,
} from '@/app/application/ports/rag/VectorStorePort';
import { rankChunksHybrid } from '@/app/domain/rag/hybridRankChunks';
import { vectorChunkToPreview } from '@/app/infrastructure/rag/ragChunkPreviewUtils';

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

  async listChunksForTenant(tenantId: string, options: RagChunkListOptions): Promise<RagChunkListResult> {
    const { limit, offset, fileName, textContains } = options;
    let rows = [...this.store.values()].filter((c) => c.tenantId === tenantId);
    if (fileName) {
      rows = rows.filter((c) => c.fileName === fileName);
    }
    if (textContains?.trim()) {
      const q = textContains.trim().toLowerCase();
      rows = rows.filter((c) => c.text.toLowerCase().includes(q));
    }
    rows.sort((a, b) => {
      const fn = a.fileName.localeCompare(b.fileName);
      if (fn !== 0) {
        return fn;
      }
      if (a.pageNumber !== b.pageNumber) {
        return a.pageNumber - b.pageNumber;
      }
      return a.id.localeCompare(b.id);
    });
    const total = rows.length;
    const page = rows.slice(offset, offset + limit).map((c) => vectorChunkToPreview(c));
    return { chunks: page, total };
  }

  async searchHybrid(
    tenantId: string,
    query: string,
    queryEmbedding: readonly number[],
    limit: number,
    options?: HybridSearchOptions,
  ): Promise<readonly HybridSearchHit[]> {
    const candidates = [...this.store.values()].filter((c) => c.tenantId === tenantId);
    return rankChunksHybrid(candidates, query, queryEmbedding, limit, options);
  }
}
