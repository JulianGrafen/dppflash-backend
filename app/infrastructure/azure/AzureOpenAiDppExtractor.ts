import { DPP_SCHEMA_VERSION, type DppProductPassport } from '@/app/domain/dpp/dppSchema';
import type {
  SemanticDppExtractionInput,
  SemanticDppExtractionPort,
  SemanticDppExtractionResult,
} from '@/app/application/ports/SemanticDppExtractionPort';
import type { SafeLoggerPort } from '@/app/application/ports/SafeLoggerPort';
import type { AzureOpenAiConfig } from '@/app/infrastructure/azure/azureConfig';
import { renderPdfPagesAsImages } from '@/app/utils/pdfPageImages';
import { readPdf } from '@/app/utils/pdfReader';

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

type AzureOpenAiUserContentPart =
  | {
      readonly type: 'text';
      readonly text: string;
    }
  | {
      readonly type: 'image_url';
      readonly image_url: {
        readonly url: string;
        readonly detail: 'high';
      };
    };

const MAX_DOCUMENT_TEXT_CHARS = 20_000;
const MAX_ERROR_BODY_CHARS = 700;

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

function buildUserPrompt(documentText: string, productTypeHint?: string): string {
  const hint = productTypeHint ? `Product type hint: ${productTypeHint}` : 'No product type hint provided.';

  return `${hint}

Extract the ESPR DPP fields from this PDF-derived document text. The PDF was converted locally before this Azure OpenAI call, so treat the text as the source of truth and never invent missing values.

${documentText.slice(0, MAX_DOCUMENT_TEXT_CHARS)}`;
}

function buildVisionPrompt(productTypeHint?: string): string {
  const hint = productTypeHint ? `Product type hint: ${productTypeHint}` : 'No product type hint provided.';

  return `${hint}

The attached images are rendered pages from a PDF technical data sheet. Read the visible content and extract the ESPR Digital Product Passport fields. Do not invent missing values. Return only the required JSON object.`;
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
}

export class AzureOpenAiDppExtractor implements SemanticDppExtractionPort {
  constructor(
    private readonly config: AzureOpenAiConfig,
    private readonly logger: SafeLoggerPort,
  ) {}

  async extract(input: SemanticDppExtractionInput): Promise<SemanticDppExtractionResult> {
    const preparedInput = await this.prepareInput(input);
    const requestUrl = this.chatCompletionsUrl();

    this.logger.info('azure_openai_request_started', {
      endpoint: this.config.endpoint,
      deployment: this.config.deploymentName,
      apiVersion: this.config.apiVersion,
      requestMode: Array.isArray(preparedInput.userContent) ? 'vision' : 'text',
      requestUrl,
    });

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
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: preparedInput.userContent },
        ],
      }),
    });

    if (!response.ok) {
      const responseBody = await response.text();
      const requestId = response.headers.get('x-request-id')
        || response.headers.get('apim-request-id')
        || response.headers.get('x-ms-request-id')
        || 'n/a';

      this.logger.error('azure_openai_request_failed', {
        status: response.status,
        statusText: response.statusText,
        deployment: this.config.deploymentName,
        apiVersion: this.config.apiVersion,
        endpoint: this.config.endpoint,
        requestId,
        responseBody: truncate(responseBody, MAX_ERROR_BODY_CHARS),
      });

      throw new Error(
        `Azure OpenAI extraction failed with status ${response.status}. Deployment="${this.config.deploymentName}", apiVersion="${this.config.apiVersion}", requestId="${requestId}". Body: ${truncate(responseBody, MAX_ERROR_BODY_CHARS)}`,
      );
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
      pageCount: preparedInput.pageCount,
    };
  }

  private async prepareInput(input: SemanticDppExtractionInput): Promise<{
    readonly userContent: string | readonly AzureOpenAiUserContentPart[];
    readonly pageCount: number;
  }> {
    try {
      const pdfContent = await readPdf(input.pdf, input.fileName);

      this.logger.info('pdf_text_prepared_for_azure_openai', {
        fileSizeBytes: input.pdf.byteLength,
        pageCount: pdfContent.pageCount,
        textLength: pdfContent.text.length,
      });

      return {
        userContent: buildUserPrompt(pdfContent.text, input.productTypeHint),
        pageCount: pdfContent.pageCount,
      };
    } catch (error) {
      this.logger.warn('pdf_text_extraction_failed_using_vision_fallback', {
        fileSizeBytes: input.pdf.byteLength,
        reason: error instanceof Error ? error.message : 'unknown',
      });

      const renderedPages = await renderPdfPagesAsImages(input.pdf);

      if (renderedPages.images.length === 0) {
        throw new Error('PDF could not be converted to text or rendered page images.');
      }

      this.logger.info('pdf_images_prepared_for_azure_openai', {
        pageCount: renderedPages.pageCount,
        renderedPageCount: renderedPages.images.length,
      });

      return {
        userContent: [
          { type: 'text', text: buildVisionPrompt(input.productTypeHint) },
          ...renderedPages.images.map((image) => ({
            type: 'image_url' as const,
            image_url: {
              url: image.dataUrl,
              detail: 'high' as const,
            },
          })),
        ],
        pageCount: renderedPages.pageCount,
      };
    }
  }

  private chatCompletionsUrl(): string {
    return `${this.config.endpoint}/openai/deployments/${this.config.deploymentName}/chat/completions?api-version=${this.config.apiVersion}`;
  }
}
