import type { EmbeddingPort } from '@/app/application/ports/rag/EmbeddingPort';

const EMBEDDING_DIM = 1536;

function hashString(value: string): number {
  let hash = 2166136261;

  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function deterministicUnitVector(text: string, dimensions: number): number[] {
  const vector = new Array<number>(dimensions).fill(0);
  const seed = hashString(text);

  for (let i = 0; i < dimensions; i += 1) {
    const angle = Math.sin(seed + i * 9973) * 0.5 + 0.5;
    vector[i] = angle;
  }

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / norm);
}

/**
 * Deterministic embeddings for CI / local dev without `OPENAI_API_KEY`.
 */
export class MockEmbeddingAdapter implements EmbeddingPort {
  readonly name = 'MockEmbeddingAdapter';

  async embed(inputs: readonly string[]): Promise<readonly (readonly number[])[]> {
    return inputs.map((text) => deterministicUnitVector(text, EMBEDDING_DIM));
  }
}
