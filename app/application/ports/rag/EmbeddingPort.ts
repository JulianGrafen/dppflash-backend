export interface EmbeddingPort {
  readonly name: string;

  /**
   * Returns one embedding vector per input string (same order). Uses OpenAI
   * `text-embedding-3-small` in the production adapter.
   */
  embed(inputs: readonly string[]): Promise<readonly (readonly number[])[]>;
}
