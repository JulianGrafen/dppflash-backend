export interface VectorChunkRecord {
  readonly id: string;
  readonly tenantId: string;
  /** Canonical product entity (`products.id`) when using entity-centric RAG. */
  readonly productId?: string | null;
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
  readonly productId?: string | null;
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

/** Optional boosts for hybrid search: overlap with product identity tokens and same-PDF preference. */
export interface HybridSearchOptions {
  readonly productMatchTerms?: readonly string[];
  readonly sourceFileName?: string;
  /** When set, Supabase store prefers chunks for this `products.id`; falls back to tenant-wide. */
  readonly productEntityId?: string | null;
}

export interface DeleteAllRagChunksFilters {
  /**
   * Nur Chunks dieses Mandanten entfernen.
   * Fehlt die Angabe, wird der **gesamte** RAG-Index geleert (alle Mandanten).
   */
  readonly tenantId?: string;
}

export interface VectorStorePort {
  readonly name: string;

  upsertChunks(chunks: readonly VectorChunkRecord[]): Promise<void>;

  /**
   * Entfernt indexierte Chunks aus dem Vektor-/Hybrid-Store (Supabase `rag_chunks` oder In-Memory).
   */
  deleteAllChunks(filters?: DeleteAllRagChunksFilters): Promise<{ readonly deletedCount: number }>;

  /**
   * Returns ranked chunks for a tenant. Implementations may ignore vector/keyword split
   * and only expose a combined search used by HybridRetrievalService.
   */
  searchHybrid(
    tenantId: string,
    query: string,
    queryEmbedding: readonly number[],
    limit: number,
    options?: HybridSearchOptions,
  ): Promise<readonly HybridSearchHit[]>;

  /**
   * Paginated listing for dashboards (no embeddings). Used by RAG “brain” visualizer.
   */
  listChunksForTenant(tenantId: string, options: RagChunkListOptions): Promise<RagChunkListResult>;
}
