import type { ComplianceLlmPort } from '@/app/application/ports/rag/ComplianceLlmPort';
import type { AzureOpenAiComplianceChatConfig } from '@/app/infrastructure/azure/azureConfig';

interface AzureOpenAiChatResponse {
  readonly choices?: readonly {
    readonly message?: {
      readonly content?: string;
    };
  }[];
}

const MAX_ERROR_BODY_CHARS = 700;

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}...`;
}

/**
 * Production compliance / gap-targeted JSON synthesis via **Azure OpenAI** Chat Completions
 * (network I/O). Reuses dieselben Env-Variablen wie die DPP-Extraktion; optionales
 * `AZURE_OPENAI_COMPLIANCE_DEPLOYMENT` für ein separates JSON-fähiges Deployment.
 */
export class AzureOpenAiComplianceLlm implements ComplianceLlmPort {
  readonly name = 'AzureOpenAiComplianceLlm';

  constructor(private readonly config: AzureOpenAiComplianceChatConfig) {}

  private chatCompletionsUrl(): string {
    const deployment = encodeURIComponent(this.config.deploymentName);
    const apiVersion = encodeURIComponent(this.config.apiVersion);
    return `${this.config.endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
  }

  async completeJson(systemPrompt: string, userPrompt: string): Promise<string> {
    const requestUrl = this.chatCompletionsUrl();

    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': this.config.apiKey,
      },
      body: JSON.stringify({
        model: this.config.modelName,
        response_format: { type: 'json_object' },
        temperature: 0,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const responseBody = await response.text();
      const requestId =
        response.headers.get('x-request-id') ||
        response.headers.get('apim-request-id') ||
        response.headers.get('x-ms-request-id') ||
        'n/a';
      throw new Error(
        `Azure OpenAI compliance LLM failed (${response.status}). deployment="${this.config.deploymentName}", requestId="${requestId}": ${truncate(responseBody, MAX_ERROR_BODY_CHARS)}`,
      );
    }

    const payload = (await response.json()) as AzureOpenAiChatResponse;
    const content = payload.choices?.[0]?.message?.content;

    if (!content?.trim()) {
      throw new Error('Azure OpenAI compliance LLM returned empty message content.');
    }

    return content;
  }
}
