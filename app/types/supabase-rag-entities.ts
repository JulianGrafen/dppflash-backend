/**
 * Row shapes for entity-centric RAG tables (mirrors Supabase public schema).
 * Use with `createClient<Database>()` once a generated Database type is adopted.
 */
export interface ProductEntityRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly name: string;
  readonly normalized_name: string;
  readonly created_at: string;
}

export interface RagChunkEntityRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly file_name: string;
  readonly page_number: number;
  readonly chunk_text: string;
  readonly tokens: readonly string[];
  readonly embedding: readonly number[];
  readonly created_at: string;
  readonly product_id: string | null;
}

export interface MatchProductBySimilarityRow {
  readonly id: string;
  readonly sim: number;
}
