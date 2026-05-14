import type { RagComplianceOrchestrator } from '@/app/application/use-cases/rag/RagComplianceOrchestrator';
import { ProductEntityService } from '@/app/application/services/rag/ProductEntityService';
import type {
  VectorStorePort,
  RagChunkListOptions,
  RagChunkListResult,
  DeleteAllRagChunksFilters,
} from '@/app/application/ports/rag/VectorStorePort';
import { supabase } from '@/app/lib/supabase';
import { createRagComplianceOrchestrator } from '@/app/infrastructure/rag/ragMvpComposition';
import { InMemoryVectorStore } from '@/app/infrastructure/rag/InMemoryVectorStore';
import { LocalPdfLayoutParser } from '@/app/infrastructure/rag/LocalPdfLayoutParser';
import { SupabaseRagChunkStore } from '@/app/infrastructure/rag/SupabaseRagChunkStore';

type RagVectorStore = VectorStorePort & {
  getStatsForTenant(tenantId: string): Promise<{
    readonly chunkCount: number;
    readonly distinctFileNames: readonly string[];
  }>;
};

type RagGlobal = typeof globalThis & {
  __dppfRagOrchestrator?: RagComplianceOrchestrator;
  __dppfRagVectorStore?: RagVectorStore;
  __dppfProductEntityService?: ProductEntityService | null;
};

function globalRag(): RagGlobal {
  return globalThis as RagGlobal;
}

function createRagVectorStore(): RagVectorStore {
  if (supabase) {
    return new SupabaseRagChunkStore(supabase);
  }
  return new InMemoryVectorStore();
}

export function getProductEntityService(): ProductEntityService | null {
  getRagComplianceOrchestrator();
  return globalRag().__dppfProductEntityService ?? null;
}

/**
 * One shared RAG stack per Node process. Uses **Supabase** (`rag_chunks`) when
 * `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set; otherwise in-memory.
 */
export function getRagComplianceOrchestrator(): RagComplianceOrchestrator {
  const g = globalRag();
  if (!g.__dppfRagOrchestrator) {
    const vectorStore = createRagVectorStore();
    g.__dppfRagVectorStore = vectorStore;
    const productEntityService = supabase ? new ProductEntityService(supabase) : null;
    g.__dppfProductEntityService = productEntityService;
    g.__dppfRagOrchestrator = createRagComplianceOrchestrator({
      vectorStore,
      layoutParser: new LocalPdfLayoutParser(),
      productEntityService,
    });
  }
  return g.__dppfRagOrchestrator;
}

export async function getRagIndexStatsForTenant(tenantId: string): Promise<{
  readonly chunkCount: number;
  readonly distinctFileNames: readonly string[];
}> {
  getRagComplianceOrchestrator();
  const store = globalRag().__dppfRagVectorStore;
  if (!store) {
    return { chunkCount: 0, distinctFileNames: [] };
  }
  return store.getStatsForTenant(tenantId);
}

export async function listRagIndexChunksForTenant(
  tenantId: string,
  options: RagChunkListOptions,
): Promise<RagChunkListResult> {
  getRagComplianceOrchestrator();
  const store = globalRag().__dppfRagVectorStore;
  if (!store) {
    return { chunks: [], total: 0 };
  }
  return store.listChunksForTenant(tenantId, options);
}

/**
 * Entfernt alle RAG-Index-Chunks (Embeddings/Tokens im Store).
 * Ohne `tenantId`: **gesamter** Index; mit `tenantId`: nur dieser Mandant.
 */
export async function deleteAllRagChunks(
  filters?: DeleteAllRagChunksFilters,
): Promise<{ readonly deletedCount: number }> {
  getRagComplianceOrchestrator();
  const store = globalRag().__dppfRagVectorStore;
  if (!store) {
    return { deletedCount: 0 };
  }
  return store.deleteAllChunks(filters);
}
