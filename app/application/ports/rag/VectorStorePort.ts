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
}
