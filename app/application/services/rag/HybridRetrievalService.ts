import type { EmbeddingPort } from '@/app/application/ports/rag/EmbeddingPort';
import type { HybridSearchHit, VectorStorePort } from '@/app/application/ports/rag/VectorStorePort';

export interface HybridRetrievalDependencies {
  readonly embedder: EmbeddingPort;
  readonly vectorStore: VectorStorePort;
}

export interface HybridRetrievalInput {
  readonly tenantId: string;
  readonly query: string;
  readonly topK?: number;
  readonly productMatchTerms?: readonly string[];
  readonly sourceFileName?: string;
  /** Prefer chunks linked to this `products.id` (entity-centric RAG). */
  readonly productEntityId?: string;
}

export type RetrievedChunk = HybridSearchHit;

/**
 * Hybrid retrieval: dense vectors + BM25-lite keyword scoring inside the vector store.
 */
export class HybridRetrievalService {
  constructor(private readonly dependencies: HybridRetrievalDependencies) {}

  async retrieveTopChunks(input: HybridRetrievalInput): Promise<readonly RetrievedChunk[]> {
    const topK = input.topK ?? 5;
    const [queryVector] = await this.dependencies.embedder.embed([input.query]);

    const searchOptions =
      (input.productMatchTerms?.length ?? 0) > 0 || input.sourceFileName || input.productEntityId?.trim()
        ? {
            productMatchTerms: input.productMatchTerms,
            sourceFileName: input.sourceFileName,
            productEntityId: input.productEntityId,
          }
        : undefined;

    return this.dependencies.vectorStore.searchHybrid(
      input.tenantId,
      input.query,
      queryVector,
      topK,
      searchOptions,
    );
  }
}
