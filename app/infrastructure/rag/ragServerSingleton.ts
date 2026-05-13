import type { RagComplianceOrchestrator } from '@/app/application/use-cases/rag/RagComplianceOrchestrator';
import { createRagComplianceOrchestrator } from '@/app/infrastructure/rag/ragMvpComposition';
import { InMemoryVectorStore } from '@/app/infrastructure/rag/InMemoryVectorStore';
import { LocalPdfLayoutParser } from '@/app/infrastructure/rag/LocalPdfLayoutParser';

type RagGlobal = typeof globalThis & {
  __dppfRagOrchestrator?: RagComplianceOrchestrator;
  __dppfRagVectorStore?: InMemoryVectorStore;
};

function globalRag(): RagGlobal {
  return globalThis as RagGlobal;
}

/**
 * One shared in-process RAG stack (vector index + embedder + parser).
 * Survives hot reload in dev via `globalThis`; on serverless cold starts the index is empty again
 * until you re-upload — replace {@link InMemoryVectorStore} with a hosted vector DB for production.
 */
export function getRagComplianceOrchestrator(): RagComplianceOrchestrator {
  const g = globalRag();
  if (!g.__dppfRagOrchestrator) {
    const vectorStore = new InMemoryVectorStore();
    g.__dppfRagVectorStore = vectorStore;
    g.__dppfRagOrchestrator = createRagComplianceOrchestrator({
      vectorStore,
      layoutParser: new LocalPdfLayoutParser(),
    });
  }
  return g.__dppfRagOrchestrator;
}

export function getRagIndexStatsForTenant(tenantId: string): {
  readonly chunkCount: number;
  readonly distinctFileNames: readonly string[];
} {
  const store = globalRag().__dppfRagVectorStore;
  if (!store) {
    return { chunkCount: 0, distinctFileNames: [] };
  }
  return store.getStatsForTenant(tenantId);
}
