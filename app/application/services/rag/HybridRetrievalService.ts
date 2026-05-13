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

    return this.dependencies.vectorStore.searchHybrid(
      input.tenantId,
      input.query,
      queryVector,
      topK,
    );
  }
}
