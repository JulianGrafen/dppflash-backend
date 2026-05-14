import type { RagChunkPreview } from '@/app/application/ports/rag/VectorStorePort';

export const RAG_CHUNK_TEXT_PREVIEW_MAX_CHARS = 480;

export function vectorChunkToPreview(input: {
  readonly id: string;
  readonly fileName: string;
  readonly pageNumber: number;
  readonly text: string;
  readonly tokens: readonly string[];
}): RagChunkPreview {
  const { text } = input;
  const truncated = text.length <= RAG_CHUNK_TEXT_PREVIEW_MAX_CHARS
    ? text
    : `${text.slice(0, RAG_CHUNK_TEXT_PREVIEW_MAX_CHARS)}…`;

  return {
    id: input.id,
    fileName: input.fileName,
    pageNumber: input.pageNumber,
    textPreview: truncated,
    textLength: text.length,
    tokenCount: input.tokens.length,
  };
}
