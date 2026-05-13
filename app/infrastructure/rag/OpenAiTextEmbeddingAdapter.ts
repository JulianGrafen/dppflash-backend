import OpenAI from 'openai';
import type { EmbeddingPort } from '@/app/application/ports/rag/EmbeddingPort';

/**
 * Production path: OpenAI `text-embedding-3-small`.
 * Requires `OPENAI_API_KEY`.
 */
export class OpenAiTextEmbeddingAdapter implements EmbeddingPort {
  readonly name = 'OpenAiTextEmbeddingAdapter';

  private readonly client: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required for OpenAiTextEmbeddingAdapter.');
    }

    this.client = new OpenAI({ apiKey });
  }

  async embed(inputs: readonly string[]): Promise<readonly (readonly number[])[]> {
    if (inputs.length === 0) {
      return [];
    }

    const response = await this.client.embeddings.create({
      model: 'text-embedding-3-small',
      input: [...inputs],
    });

    const sorted = [...response.data].sort((a, b) => a.index - b.index);
    return sorted.map((entry) => entry.embedding as number[]);
  }
}
