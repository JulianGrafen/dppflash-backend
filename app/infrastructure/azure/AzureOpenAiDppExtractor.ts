import { DPP_SCHEMA_VERSION, type DppProductPassport } from '@/app/domain/dpp/dppSchema';
import type {
  SemanticDppExtractionInput,
  SemanticDppExtractionPort,
  SemanticDppExtractionResult,
} from '@/app/application/ports/SemanticDppExtractionPort';
import type { SafeLoggerPort } from '@/app/application/ports/SafeLoggerPort';
import type { AzureOpenAiConfig } from '@/app/infrastructure/azure/azureConfig';

interface AzureOpenAiChatResponse {
  readonly choices?: readonly {
    readonly message?: {
      readonly content?: string;
    };
  }[];
}

interface DppExtractionEnvelope {
  readonly dpp: DppProductPassport;
  readonly confidence?: number;
  readonly warnings?: readonly string[];
}

const MAX_DOCUMENT_TEXT_CHARS = 20_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseExtractionEnvelope(content: string): DppExtractionEnvelope {
  const parsed = JSON.parse(content) as unknown;

  if (!isRecord(parsed) || !isRecord(parsed.dpp)) {
    throw new Error('Azure OpenAI response does not match the DPP extraction envelope.');
  }

  return parsed as unknown as DppExtractionEnvelope;
}

function buildSystemPrompt(): string {
  return `You extract Digital Product Passport data for EU ESPR compliance.
Return only JSON with this exact shape:
{
  "dpp": {
    "schemaVersion": "${DPP_SCHEMA_VERSION}",
    "declaredProductType": "optional string such as Klebstoff, adhesive, battery or textile",
    "upi": "string",
    "gtin": "valid GTIN-8/12/13/14 string",
    "materialComposition": [{ "material": "string", "percentage": 0 }],
    "recycledContent": [{ "material": "string", "percentage": 0 }],
    "carbonFootprint": {
      "valueKgCo2e": 0,
      "lifecycleStage": "optional string",
      "calculationMethod": "optional string"
    },
    "substancesOfConcern": [{
      "name": "string",
      "casNumber": "optional string",
      "concentrationPercent": 0,
      "hazardClass": "optional string"
    }]
  },
  "confidence": 0.0,
  "warnings": ["string"]
}
Use null-free JSON. If a required value is not in the document, use an empty string or empty array and add a warning. Do not invent GTINs, UPIs, materials, substances or carbon data.`;
}

function buildUserPrompt(input: SemanticDppExtractionInput): string {
  const hint = input.productTypeHint ? `Product type hint: ${input.productTypeHint}` : 'No product type hint provided.';

  return `${hint}

Extract the ESPR DPP fields from this document text:

${input.documentText.slice(0, MAX_DOCUMENT_TEXT_CHARS)}`;
}

export class AzureOpenAiDppExtractor implements SemanticDppExtractionPort {
  constructor(
    private readonly config: AzureOpenAiConfig,
    private readonly logger: SafeLoggerPort,
  ) {}

  async extract(input: SemanticDppExtractionInput): Promise<SemanticDppExtractionResult> {
    const response = await fetch(this.chatCompletionsUrl(), {
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
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: buildUserPrompt(input) },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Azure OpenAI extraction failed with status ${response.status}.`);
    }

    const payload = (await response.json()) as AzureOpenAiChatResponse;
    const content = payload.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Azure OpenAI returned an empty extraction response.');
    }

    const envelope = parseExtractionEnvelope(content);

    this.logger.info('azure_openai_extraction_completed', {
      confidence: envelope.confidence ?? 0,
      warningCount: envelope.warnings?.length ?? 0,
    });

    return {
      dpp: envelope.dpp,
      confidence: envelope.confidence ?? 0,
      warnings: envelope.warnings ?? [],
    };
  }

  private chatCompletionsUrl(): string {
    return `${this.config.endpoint}/openai/deployments/${this.config.deploymentName}/chat/completions?api-version=${this.config.apiVersion}`;
  }
}
