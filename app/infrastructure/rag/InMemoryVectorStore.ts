import type {
  HybridSearchHit,
  HybridSearchOptions,
  ListChunksByFileNamesParams,
  VectorChunkRecord,
  VectorStorePort,
  RagChunkListOptions,
  RagChunkListResult,
  DeleteAllRagChunksFilters,
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

  async deleteAllChunks(filters?: DeleteAllRagChunksFilters): Promise<{ readonly deletedCount: number }> {
    const tenantId = filters?.tenantId;
    if (tenantId === undefined || tenantId === '') {
      const deletedCount = this.store.size;
      this.store.clear();
      return { deletedCount };
    }
    let deletedCount = 0;
    for (const [id, chunk] of this.store) {
      if (chunk.tenantId === tenantId) {
        this.store.delete(id);
        deletedCount += 1;
      }
    }
    return { deletedCount };
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

  async listChunksByFileNames(params: ListChunksByFileNamesParams): Promise<readonly HybridSearchHit[]> {
    const nameSet = new Set(params.fileNames.map((n) => n.trim()).filter(Boolean));
    if (nameSet.size === 0) {
      return [];
    }
    const maxRows = Math.min(Math.max(1, params.maxRows), 10_000);
    let rows = [...this.store.values()].filter(
      (c) => c.tenantId === params.tenantId && nameSet.has(c.fileName),
    );
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
    rows = rows.slice(0, maxRows);
    return rows.map((c) => ({
      id: c.id,
      tenantId: c.tenantId,
      productId: c.productId ?? null,
      fileName: c.fileName,
      pageNumber: c.pageNumber,
      text: c.text,
      score: 0,
      keywordScore: 0,
      vectorScore: 0,
    }));
  }

  async searchHybrid(
    tenantId: string,
    query: string,
    queryEmbedding: readonly number[],
    limit: number,
    options?: HybridSearchOptions,
  ): Promise<readonly HybridSearchHit[]> {
    let candidates = [...this.store.values()].filter((c) => c.tenantId === tenantId);
    const pe = options?.productEntityId?.trim();
    if (pe) {
      const scoped = candidates.filter((c) => c.productId === pe);
      if (scoped.length > 0) {
        candidates = scoped;
      }
    }
    return rankChunksHybrid(candidates, query, queryEmbedding, limit, options);
  }
}
