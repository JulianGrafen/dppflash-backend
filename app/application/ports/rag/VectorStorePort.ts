export interface VectorChunkRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly fileName: string;
  readonly pageNumber: number;
  readonly text: string;
  readonly embedding: readonly number[];
  /** Lowercased tokens for keyword / BM25-lite scoring */
  readonly tokens: readonly string[];
}

export interface HybridSearchHit {
  readonly id: string;
  readonly tenantId: string;
  readonly fileName: string;
  readonly pageNumber: number;
  readonly text: string;
  readonly score: number;
  readonly keywordScore: number;
  readonly vectorScore: number;
}

/** Ops / dashboard: chunk row without embedding payload. */
export interface RagChunkPreview {
  readonly id: string;
  readonly fileName: string;
  readonly pageNumber: number;
  readonly textPreview: string;
  readonly textLength: number;
  readonly tokenCount: number;
}

export interface RagChunkListOptions {
  readonly limit: number;
  readonly offset: number;
  readonly fileName?: string;
  /** Case-insensitive substring filter on full chunk text (optional). */
  readonly textContains?: string;
}

export interface RagChunkListResult {
  readonly chunks: readonly RagChunkPreview[];
  readonly total: number;
}

export interface VectorStorePort {
  readonly name: string;

  upsertChunks(chunks: readonly VectorChunkRecord[]): Promise<void>;

  /**
   * Returns ranked chunks for a tenant. Implementations may ignore vector/keyword split
   * and only expose a combined search used by HybridRetrievalService.
   */
  searchHybrid(
    tenantId: string,
    query: string,
    queryEmbedding: readonly number[],
    limit: number,
  ): Promise<readonly HybridSearchHit[]>;

  /**
   * Paginated listing for dashboards (no embeddings). Used by RAG “brain” visualizer.
   */
  listChunksForTenant(tenantId: string, options: RagChunkListOptions): Promise<RagChunkListResult>;
}
