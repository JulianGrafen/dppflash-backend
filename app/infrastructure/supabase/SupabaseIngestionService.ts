import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EmbeddingPort } from '@/app/application/ports/rag/EmbeddingPort';
import type { SemanticChunk } from '@/app/domain/rag/semanticChunker';
import { OpenAiTextEmbeddingAdapter } from '@/app/infrastructure/rag/OpenAiTextEmbeddingAdapter';
import { OpenAiEmbeddingCallError, SupabaseIngestionError } from '@/app/infrastructure/supabase/ragEnterpriseErrors';
import { requireSupabaseServiceRoleClient } from '@/app/lib/supabase/requireServiceRoleClient';

const EMBEDDING_DIM = 1536;
const CHUNK_INSERT_BATCH = 120;

export interface SupabaseIngestionInput {
  readonly tenantId: string;
  readonly fileName: string;
  readonly chunks: readonly SemanticChunk[];
}

export interface SupabaseIngestionResult {
  readonly documentId: string;
  readonly chunkIds: readonly string[];
}

type DocumentInsertRow = {
  readonly tenant_id: string;
  readonly file_name: string;
};

type DocumentIdRow = {
  readonly id: string;
};

type ChunkInsertRow = {
  readonly id: string;
  readonly document_id: string;
  readonly tenant_id: string;
  readonly page_number: number;
  readonly content: string;
  /** pgvector literal accepted by PostgREST for `vector(1536)` columns */
  readonly embedding: string;
};

/**
 * Persists parsed PDF chunks into `documents` + `document_chunks` (pgvector).
 *
 * Expected columns:
 * - `documents`: `id`, `tenant_id`, `file_name`, …
 * - `document_chunks`: `id`, `document_id`, `tenant_id`, `page_number`, `content`, `embedding vector(1536)`
 */
export class SupabaseIngestionService {
  constructor(
    private readonly client: SupabaseClient,
    private readonly embedder: EmbeddingPort,
  ) {}

  async ingestParsedPdfChunks(input: SupabaseIngestionInput): Promise<SupabaseIngestionResult> {
    if (input.chunks.length === 0) {
      throw new SupabaseIngestionError('ingestParsedPdfChunks: chunks array is empty.');
    }

    const { data: doc, error: docError } = await this.client
      .from('documents')
      .insert({
        tenant_id: input.tenantId,
        file_name: input.fileName,
      } satisfies DocumentInsertRow)
      .select('id')
      .single<DocumentIdRow>();

    if (docError || !doc?.id) {
      throw new SupabaseIngestionError(
        `Failed to insert document row: ${docError?.message ?? 'unknown error'}`,
        { cause: docError },
      );
    }

    const documentId = doc.id;

    let embeddings: readonly (readonly number[])[];
    try {
      embeddings = await this.embedder.embed(input.chunks.map((c) => c.text));
    } catch (cause) {
      throw new OpenAiEmbeddingCallError('OpenAI embedding call failed during ingestion.', {
        cause,
      });
    }

    if (embeddings.length !== input.chunks.length) {
      throw new OpenAiEmbeddingCallError(
        `Embedding provider returned ${embeddings.length} vectors for ${input.chunks.length} chunks.`,
      );
    }

    const chunkIds: string[] = [];
    const rows: ChunkInsertRow[] = [];

    for (let i = 0; i < input.chunks.length; i += 1) {
      const chunk = input.chunks[i]!;
      const vector = embeddings[i]!;

      if (vector.length !== EMBEDDING_DIM) {
        throw new OpenAiEmbeddingCallError(
          `Expected embedding dimension ${EMBEDDING_DIM}, received ${vector.length}.`,
        );
      }

      const id = randomUUID();
      chunkIds.push(id);
      rows.push({
        id,
        document_id: documentId,
        tenant_id: input.tenantId,
        page_number: chunk.pageNumber,
        content: chunk.text,
        embedding: toPgVectorLiteral(vector),
      });
    }

    for (let offset = 0; offset < rows.length; offset += CHUNK_INSERT_BATCH) {
      const batch = rows.slice(offset, offset + CHUNK_INSERT_BATCH);
      const { error: chunkError } = await this.client.from('document_chunks').insert(batch);

      if (chunkError) {
        throw new SupabaseIngestionError(
          `Failed to bulk-insert document_chunks: ${chunkError.message}`,
          { cause: chunkError },
        );
      }
    }

    return { documentId, chunkIds };
  }
}

function toPgVectorLiteral(embedding: readonly number[]): string {
  return `[${embedding.map((v) => (Number.isFinite(v) ? v : 0)).join(',')}]`;
}

export function createSupabaseIngestionService(embedder?: EmbeddingPort): SupabaseIngestionService {
  return new SupabaseIngestionService(
    requireSupabaseServiceRoleClient(),
    embedder ?? new OpenAiTextEmbeddingAdapter(),
  );
}
