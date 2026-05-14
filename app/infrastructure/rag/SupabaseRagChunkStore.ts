import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  HybridSearchHit,
  HybridSearchOptions,
  ListChunksByFileNamesParams,
  VectorChunkRecord,
  VectorStorePort,
  RagChunkListOptions,
  RagChunkListResult,
  DeleteAllRagChunksFilters,
} from '@/app/application/ports/rag/VectorStorePort';
import { rankChunksHybrid } from '@/app/domain/rag/hybridRankChunks';
import { vectorChunkToPreview } from '@/app/infrastructure/rag/ragChunkPreviewUtils';

const EMBEDDING_DIM = 1536;
const FETCH_CAP = 8_000;
const UPSERT_BATCH = 150;

type RagChunkRow = {
  readonly id: string;
  readonly tenant_id: string;
  readonly product_id?: string | null;
  readonly file_name: string;
  readonly page_number: number;
  readonly chunk_text: string;
  readonly tokens: string[] | null;
  readonly embedding: number[] | string | null;
};

function toVectorChunkRecord(row: RagChunkRow): VectorChunkRecord {
  const emb = row.embedding;
  let embedding: readonly number[] = [];

  if (Array.isArray(emb)) {
    embedding = emb.map((n) => Number(n));
  } else if (typeof emb === 'string') {
    try {
      const parsed = JSON.parse(emb) as unknown;
      if (Array.isArray(parsed)) {
        embedding = parsed.map((n) => Number(n));
      }
    } catch {
      embedding = [];
    }
  }

  if (embedding.length !== EMBEDDING_DIM) {
    embedding = Array.from({ length: EMBEDDING_DIM }, (_, i) => embedding[i] ?? 0);
  }

  return {
    id: row.id,
    tenantId: row.tenant_id,
    productId: row.product_id ?? null,
    fileName: row.file_name,
    pageNumber: row.page_number,
    text: row.chunk_text,
    embedding,
    tokens: Array.isArray(row.tokens) ? row.tokens : [],
  };
}

function escapeForPostgresIlike(raw: string): string {
  return raw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * Hybrid RAG index backed by Postgres (Supabase). Survives cold starts and scales with DB limits.
 *
 * Retrieval loads up to {@link FETCH_CAP} chunks per tenant and ranks in-process (same logic as in-memory).
 */
export class SupabaseRagChunkStore implements VectorStorePort {
  readonly name = 'SupabaseRagChunkStore';

  constructor(private readonly client: SupabaseClient) {}

  async deleteAllChunks(filters?: DeleteAllRagChunksFilters): Promise<{ readonly deletedCount: number }> {
    const tenantId = filters?.tenantId?.trim();
    let total = 0;
    const batch = 5000;

    for (;;) {
      let q = this.client.from('rag_chunks').delete().select('id').limit(batch);
      if (tenantId) {
        q = q.eq('tenant_id', tenantId);
      } else {
        q = q.neq('id', '');
      }

      const { data, error } = await q;

      if (error) {
        throw new Error(`rag_chunks delete: ${error.message}`);
      }

      const n = data?.length ?? 0;
      total += n;
      if (n === 0) {
        break;
      }
    }

    return { deletedCount: total };
  }

  async upsertChunks(chunks: readonly VectorChunkRecord[]): Promise<void> {
    if (chunks.length === 0) {
      return;
    }

    const rows = chunks.map((c) => {
      if (c.embedding.length !== EMBEDDING_DIM) {
        throw new Error(`rag_chunks: embedding must have length ${EMBEDDING_DIM}, got ${c.embedding.length}.`);
      }

      return {
        id: c.id,
        tenant_id: c.tenantId,
        product_id: c.productId ?? null,
        file_name: c.fileName,
        page_number: c.pageNumber,
        chunk_text: c.text,
        tokens: [...c.tokens],
        embedding: [...c.embedding],
      };
    });

    for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
      const batch = rows.slice(i, i + UPSERT_BATCH);
      const { error } = await this.client.from('rag_chunks').upsert(batch, { onConflict: 'id' });

      if (error) {
        throw new Error(`rag_chunks upsert failed: ${error.message}`);
      }
    }
  }

  async getStatsForTenant(tenantId: string): Promise<{
    readonly chunkCount: number;
    readonly distinctFileNames: readonly string[];
  }> {
    const { count, error: countError } = await this.client
      .from('rag_chunks')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    if (countError) {
      throw new Error(`rag_chunks count: ${countError.message}`);
    }

    const { data, error } = await this.client
      .from('rag_chunks')
      .select('file_name')
      .eq('tenant_id', tenantId)
      .limit(50_000);

    if (error) {
      throw new Error(`rag_chunks list files: ${error.message}`);
    }

    const names = new Set((data ?? []).map((r: { file_name: string }) => r.file_name));

    return {
      chunkCount: count ?? 0,
      distinctFileNames: [...names].sort((a, b) => a.localeCompare(b)),
    };
  }

  async listChunksForTenant(tenantId: string, options: RagChunkListOptions): Promise<RagChunkListResult> {
    const { limit, offset, fileName, textContains } = options;
    const from = Math.max(0, offset);
    const lim = Math.min(Math.max(1, limit), 500);
    const to = from + lim - 1;

    let q = this.client
      .from('rag_chunks')
      .select('id, file_name, page_number, chunk_text, tokens', { count: 'exact' })
      .eq('tenant_id', tenantId);

    if (fileName) {
      q = q.eq('file_name', fileName);
    }
    if (textContains?.trim()) {
      const pattern = `%${escapeForPostgresIlike(textContains.trim())}%`;
      q = q.ilike('chunk_text', pattern);
    }

    const { data, error, count } = await q
      .order('file_name', { ascending: true })
      .order('page_number', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`rag_chunks list: ${error.message}`);
    }

    type ListRow = {
      id: string;
      file_name: string;
      page_number: number;
      chunk_text: string;
      tokens: string[] | null;
    };

    const rows = (data ?? []) as ListRow[];

    const chunks = rows.map((r) =>
      vectorChunkToPreview({
        id: r.id,
        fileName: r.file_name,
        pageNumber: r.page_number,
        text: r.chunk_text,
        tokens: Array.isArray(r.tokens) ? r.tokens : [],
      }),
    );

    return { chunks, total: count ?? chunks.length };
  }

  async listChunksByFileNames(params: ListChunksByFileNamesParams): Promise<readonly HybridSearchHit[]> {
    const names = [...new Set(params.fileNames.map((n) => n.trim()).filter(Boolean))];
    if (names.length === 0) {
      return [];
    }

    const maxRows = Math.min(Math.max(1, params.maxRows), 10_000);

    const { data, error } = await this.client
      .from('rag_chunks')
      .select('id, tenant_id, product_id, file_name, page_number, chunk_text')
      .eq('tenant_id', params.tenantId)
      .in('file_name', names)
      .order('file_name', { ascending: true })
      .order('page_number', { ascending: true })
      .order('id', { ascending: true })
      .limit(maxRows);

    if (error) {
      throw new Error(`rag_chunks listChunksByFileNames: ${error.message}`);
    }

    type Row = {
      id: string;
      tenant_id: string;
      product_id?: string | null;
      file_name: string;
      page_number: number;
      chunk_text: string;
    };

    const rows = (data ?? []) as Row[];

    return rows.map((r) => ({
      id: r.id,
      tenantId: r.tenant_id,
      productId: r.product_id ?? null,
      fileName: r.file_name,
      pageNumber: r.page_number,
      text: r.chunk_text,
      score: 0,
      keywordScore: 0,
      vectorScore: 0,
    }));
  }

  async searchHybrid(
    tenantId: string,
    query: string,
    queryEmbedding: readonly number[],
    limit: number,
    options?: HybridSearchOptions,
  ): Promise<readonly HybridSearchHit[]> {
    const productEntityId = options?.productEntityId?.trim();
    const selectCols =
      'id, tenant_id, product_id, file_name, page_number, chunk_text, tokens, embedding';

    const load = async (scopedToProduct: boolean): Promise<RagChunkRow[]> => {
      let q = this.client.from('rag_chunks').select(selectCols).eq('tenant_id', tenantId).limit(FETCH_CAP);
      if (scopedToProduct && productEntityId) {
        q = q.eq('product_id', productEntityId);
      }
      const { data, error } = await q;
      if (error) {
        throw new Error(`rag_chunks search load: ${error.message}`);
      }
      return (data ?? []) as RagChunkRow[];
    };

    let rows: RagChunkRow[];
    if (productEntityId) {
      rows = await load(true);
      if (rows.length === 0) {
        rows = await load(false);
      }
    } else {
      rows = await load(false);
    }

    const candidates = rows.map((row) => toVectorChunkRecord(row));
    return rankChunksHybrid(candidates, query, queryEmbedding, limit, options);
  }
}
