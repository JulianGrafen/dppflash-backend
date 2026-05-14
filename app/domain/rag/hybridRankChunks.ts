import type { HybridSearchHit, HybridSearchOptions, VectorChunkRecord } from '@/app/application/ports/rag/VectorStorePort';
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

const KEYWORD_WEIGHT = 0.45;
const VECTOR_WEIGHT = 0.55;

function productIdentityBoost(
  chunk: VectorChunkRecord,
  terms: readonly string[],
  sourceFileName: string | undefined,
): number {
  if (terms.length === 0 && !sourceFileName) {
    return 0;
  }

  const hay = `${chunk.text} ${chunk.fileName}`.toLowerCase();
  let hits = 0;
  for (const t of terms) {
    const n = t.toLowerCase();
    if (n.length < 2) {
      continue;
    }
    if (hay.includes(n)) {
      hits += 1;
    }
  }

  const ratio = terms.length === 0 ? 0 : hits / terms.length;
  const termBoost = Math.min(0.42, ratio * 0.55);
  const sameFile =
    sourceFileName && chunk.fileName === sourceFileName ? 0.22 : 0;
  return Math.min(0.55, termBoost + sameFile);
}

/**
 * Shared hybrid ranker (BM25-lite + cosine) used by in-memory and Supabase-backed stores.
 */
export function rankChunksHybrid(
  candidates: readonly VectorChunkRecord[],
  query: string,
  queryEmbedding: readonly number[],
  limit: number,
  options?: HybridSearchOptions,
): readonly HybridSearchHit[] {
  const queryTokens = tokenizeForRetrieval(query);

  const keywordRaw = candidates.map((c) => bm25LiteScore(queryTokens, [...c.tokens]));
  const vectorRaw = candidates.map((c) => cosineSimilarity(queryEmbedding, c.embedding));

  const keywordNorm = normalizeScores(keywordRaw);
  const vectorNorm = normalizeScores(vectorRaw);

  const terms = options?.productMatchTerms ?? [];
  const sourceFile = options?.sourceFileName;

  const ranked = candidates
    .map((c, index) => {
      const keywordScore = keywordNorm[index] ?? 0;
      const vectorScore = vectorNorm[index] ?? 0;
      const base = KEYWORD_WEIGHT * keywordScore + VECTOR_WEIGHT * vectorScore;
      const boost = productIdentityBoost(c, terms, sourceFile);
      const score = Math.min(1, base + boost);

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
