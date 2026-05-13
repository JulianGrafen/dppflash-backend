import type { RagComplianceOrchestrator } from '@/app/application/use-cases/rag/RagComplianceOrchestrator';
import type { VectorStorePort } from '@/app/application/ports/rag/VectorStorePort';
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

/**
 * One shared RAG stack per Node process. Uses **Supabase** (`rag_chunks`) when
 * `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set; otherwise in-memory.
 */
export function getRagComplianceOrchestrator(): RagComplianceOrchestrator {
  const g = globalRag();
  if (!g.__dppfRagOrchestrator) {
    const vectorStore = createRagVectorStore();
    g.__dppfRagVectorStore = vectorStore;
    g.__dppfRagOrchestrator = createRagComplianceOrchestrator({
      vectorStore,
      layoutParser: new LocalPdfLayoutParser(),
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
