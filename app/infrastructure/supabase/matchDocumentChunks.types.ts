import { z } from 'zod';

/**
 * Expected row shape returned by RPC `public.match_document_chunks`.
 * Adjust if your migration uses different column aliases (keep in sync with Postgres).
 */
export const MatchDocumentChunkRowSchema = z.object({
  chunk_id: z.string().uuid(),
  document_id: z.string().uuid(),
  file_name: z.string(),
  content: z.string(),
  page_number: z.number().int(),
  similarity: z.number(),
});

export type MatchDocumentChunkRow = z.infer<typeof MatchDocumentChunkRowSchema>;

export const MatchDocumentChunksResponseSchema = z.array(MatchDocumentChunkRowSchema);
