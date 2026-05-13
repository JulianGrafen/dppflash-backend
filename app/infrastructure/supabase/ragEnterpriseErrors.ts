/**
 * Domain-specific failures for the enterprise Supabase RAG pipeline.
 */

export class OpenAiEmbeddingCallError extends Error {
  constructor(message: string, options?: { readonly cause?: unknown }) {
    super(message, options);
    this.name = 'OpenAiEmbeddingCallError';
  }
}

export class SupabaseIngestionError extends Error {
  constructor(message: string, options?: { readonly cause?: unknown }) {
    super(message, options);
    this.name = 'SupabaseIngestionError';
  }
}

export class SupabaseRetrievalError extends Error {
  constructor(message: string, options?: { readonly cause?: unknown }) {
    super(message, options);
    this.name = 'SupabaseRetrievalError';
  }
}
