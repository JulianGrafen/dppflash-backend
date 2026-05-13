import OpenAI from 'openai';
import type { ComplianceLlmPort } from '@/app/application/ports/rag/ComplianceLlmPort';

/**
 * Production LLM for forensic JSON synthesis. Requires `OPENAI_API_KEY`.
 */
export class OpenAiComplianceLlm implements ComplianceLlmPort {
  readonly name = 'OpenAiComplianceLlm';

  private readonly client: OpenAI;

  private readonly model: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required for OpenAiComplianceLlm.');
    }

    this.client = new OpenAI({ apiKey });
    this.model = process.env.OPENAI_COMPLIANCE_MODEL ?? 'gpt-4o-mini';
  }

  async completeJson(systemPrompt: string, userPrompt: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error('OpenAI returned empty completion content.');
    }

    return content;
  }
}
