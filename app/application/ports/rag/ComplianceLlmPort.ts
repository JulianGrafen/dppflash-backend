export interface ComplianceLlmPort {
  readonly name: string;

  /**
   * Must return JSON only (object), parseable by `JSON.parse`.
   */
  completeJson(systemPrompt: string, userPrompt: string): Promise<string>;
}
