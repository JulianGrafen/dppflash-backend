import type { SupabaseClient } from '@supabase/supabase-js';
import type { EmbeddingPort } from '@/app/application/ports/rag/EmbeddingPort';
import type { RetrievedChunk } from '@/app/application/services/rag/HybridRetrievalService';
import { OpenAiTextEmbeddingAdapter } from '@/app/infrastructure/rag/OpenAiTextEmbeddingAdapter';
import {
  MatchDocumentChunkRow,
  MatchDocumentChunksResponseSchema,
} from '@/app/infrastructure/supabase/matchDocumentChunks.types';
import { OpenAiEmbeddingCallError, SupabaseRetrievalError } from '@/app/infrastructure/supabase/ragEnterpriseErrors';
import { requireSupabaseServiceRoleClient } from '@/app/lib/supabase/requireServiceRoleClient';

const DEFAULT_THRESHOLD = 0.75;
const DEFAULT_LIMIT = 5;
const EMBEDDING_DIM = 1536;

export interface SupabaseRetrievalInput {
  readonly query: string;
  readonly tenantId: string;
  readonly limit?: number;
  readonly threshold?: number;
}

type MatchDocumentChunksRpcParams = {
  readonly query_embedding: readonly number[];
  readonly match_threshold: number;
  readonly match_count: number;
  readonly filter_tenant_id: string;
};

/**
 * Vector retrieval via RPC `match_document_chunks` (pgvector + tenant filter).
 *
 * RPC contract (expected):
 * - `query_embedding vector(1536)`
 * - `match_threshold double precision`
 * - `match_count int`
 * - `filter_tenant_id text`
 *
 * Returns rows: `chunk_id`, `document_id`, `file_name`, `content`, `page_number`, `similarity`
 */
export class SupabaseRetrievalService {
  constructor(
    private readonly client: SupabaseClient,
    private readonly embedder: EmbeddingPort,
  ) {}

  async retrieveChunks(input: SupabaseRetrievalInput): Promise<readonly RetrievedChunk[]> {
    const limit = input.limit ?? DEFAULT_LIMIT;
    const threshold = input.threshold ?? DEFAULT_THRESHOLD;

    let queryEmbedding: readonly number[];
    try {
      const batch = await this.embedder.embed([input.query]);
      queryEmbedding = batch[0] ?? [];
    } catch (cause) {
      throw new OpenAiEmbeddingCallError('OpenAI embedding call failed during retrieval.', {
        cause,
      });
    }

    if (queryEmbedding.length !== EMBEDDING_DIM) {
      throw new OpenAiEmbeddingCallError(
        `Expected query embedding dimension ${EMBEDDING_DIM}, received ${queryEmbedding.length}.`,
      );
    }

    const rpcArgs: MatchDocumentChunksRpcParams = {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: limit,
      filter_tenant_id: input.tenantId,
    };

    const { data, error } = await this.client.rpc('match_document_chunks', rpcArgs);

    if (error) {
      throw new SupabaseRetrievalError(`match_document_chunks RPC failed: ${error.message}`, {
        cause: error,
      });
    }

    const parsed = MatchDocumentChunksResponseSchema.safeParse(data);
    if (!parsed.success) {
      throw new SupabaseRetrievalError(
        `match_document_chunks returned unexpected shape: ${parsed.error.message}`,
        { cause: parsed.error },
      );
    }

    return parsed.data.map((row) =>
      SupabaseRetrievalService.mapRowToRetrievedChunk(row, input.tenantId),
    );
  }

  private static mapRowToRetrievedChunk(row: MatchDocumentChunkRow, tenantId: string): RetrievedChunk {
    return {
      id: row.chunk_id,
      tenantId,
      fileName: row.file_name,
      pageNumber: row.page_number,
      text: row.content,
      score: row.similarity,
      keywordScore: 0,
      vectorScore: row.similarity,
    };
  }
}

export function createSupabaseRetrievalService(embedder?: EmbeddingPort): SupabaseRetrievalService {
  return new SupabaseRetrievalService(
    requireSupabaseServiceRoleClient(),
    embedder ?? new OpenAiTextEmbeddingAdapter(),
  );
}
