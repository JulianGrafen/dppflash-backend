import type {
  HybridSearchHit,
  VectorChunkRecord,
  VectorStorePort,
} from '@/app/application/ports/rag/VectorStorePort';
import { tokenizeForRetrieval } from '@/app/domain/rag/textTokenize';

function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length || a.length === 0) {
    return 0;
  }

  let dot = 0;
  let na = 0;
  let nb = 0;

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }

  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

function bm25LiteScore(queryTokens: readonly string[], docTokens: readonly string[]): number {
  if (queryTokens.length === 0) {
    return 0;
  }

  const docFreq = new Map<string, number>();

  for (const t of docTokens) {
    docFreq.set(t, (docFreq.get(t) ?? 0) + 1);
  }

  const docLen = docTokens.length || 1;
  const k1 = 1.2;
  const b = 0.75;
  const avgdl = 120;

  let score = 0;

  for (const qt of queryTokens) {
    const tf = docFreq.get(qt) ?? 0;
    if (tf === 0) {
      continue;
    }

    const idf = Math.log(2 + docTokens.length / (tf + 1));
    const denom = tf + k1 * (1 - b + b * (docLen / avgdl));
    score += idf * ((tf * (k1 + 1)) / denom);
  }

  return score;
}

function normalizeScores(values: number[]): number[] {
  const max = Math.max(...values, 1e-9);
  return values.map((v) => v / max);
}

/**
 * In-memory hybrid index for local/dev. Swap for Pinecone + OpenSearch in production.
 */
export class InMemoryVectorStore implements VectorStorePort {
  readonly name = 'InMemoryVectorStore';

  private readonly store = new Map<string, VectorChunkRecord>();

  async upsertChunks(chunks: readonly VectorChunkRecord[]): Promise<void> {
    for (const chunk of chunks) {
      this.store.set(chunk.id, chunk);
    }
  }

  getStatsForTenant(tenantId: string): { readonly chunkCount: number; readonly distinctFileNames: readonly string[] } {
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
    const queryTokens = tokenizeForRetrieval(query);
    const candidates = [...this.store.values()].filter((c) => c.tenantId === tenantId);

    const keywordRaw = candidates.map((c) => bm25LiteScore(queryTokens, [...c.tokens]));
    const vectorRaw = candidates.map((c) => cosineSimilarity(queryEmbedding, c.embedding));

    const keywordNorm = normalizeScores(keywordRaw);
    const vectorNorm = normalizeScores(vectorRaw);

    const keywordWeight = 0.45;
    const vectorWeight = 0.55;

    const ranked = candidates
      .map((c, index) => {
        const keywordScore = keywordNorm[index] ?? 0;
        const vectorScore = vectorNorm[index] ?? 0;
        const score = keywordWeight * keywordScore + vectorWeight * vectorScore;

        return {
          id: c.id,
          tenantId: c.tenantId,
          fileName: c.fileName,
          pageNumber: c.pageNumber,
          text: c.text,
          score,
          keywordScore,
          vectorScore,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return ranked;
  }
}
