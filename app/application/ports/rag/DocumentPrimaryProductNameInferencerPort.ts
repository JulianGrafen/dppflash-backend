/**
 * Fast LLM pass: infer the main commercial product name from an unstructured document excerpt.
 * Kept separate from compliance / gap-targeted prompting.
 */
export interface DocumentPrimaryProductNameInferencerPort {
  readonly name: string;

  inferPrimaryProductName(documentTextExcerpt: string): Promise<string | null>;
}
