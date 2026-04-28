import type { PdfAnalysisInput, PdfAnalysisPort, PdfAnalysisResult } from '@/app/application/ports/PdfAnalysisPort';
import type { SafeLoggerPort } from '@/app/application/ports/SafeLoggerPort';
import type { AzureDocumentIntelligenceConfig } from '@/app/infrastructure/azure/azureConfig';

interface AnalyzeOperationResponse {
  readonly status?: string;
  readonly analyzeResult?: {
    readonly content?: string;
    readonly pages?: readonly unknown[];
  };
  readonly error?: {
    readonly message?: string;
  };
}

const POLL_INTERVAL_MS = 1_000;
const MAX_POLL_ATTEMPTS = 60;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function parseJsonResponse(response: Response): Promise<AnalyzeOperationResponse> {
  const value = await response.json();
  return value as AnalyzeOperationResponse;
}

export class AzureDocumentIntelligencePdfAnalyzer implements PdfAnalysisPort {
  constructor(
    private readonly config: AzureDocumentIntelligenceConfig,
    private readonly logger: SafeLoggerPort,
  ) {}

  async analyze(input: PdfAnalysisInput): Promise<PdfAnalysisResult> {
    const analysisUrl = `${this.config.endpoint}/documentintelligence/documentModels/${this.config.modelId}:analyze?api-version=${this.config.apiVersion}`;
    const pdfBody = input.pdf.buffer.slice(
      input.pdf.byteOffset,
      input.pdf.byteOffset + input.pdf.byteLength,
    ) as ArrayBuffer;

    const startResponse = await fetch(analysisUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/pdf',
        'Ocp-Apim-Subscription-Key': this.config.apiKey,
      },
      body: pdfBody,
    });

    if (!startResponse.ok) {
      throw new Error(`Azure Document Intelligence analysis failed with status ${startResponse.status}.`);
    }

    const operationLocation = startResponse.headers.get('operation-location');

    if (!operationLocation) {
      throw new Error('Azure Document Intelligence did not return an operation-location header.');
    }

    this.logger.info('azure_document_intelligence_polling_started', {
      fileSizeBytes: input.pdf.byteLength,
    });

    const operation = await this.pollOperation(operationLocation);
    const content = operation.analyzeResult?.content?.trim();

    if (!content) {
      throw new Error('Azure Document Intelligence returned no extractable text.');
    }

    return {
      text: content,
      pageCount: operation.analyzeResult?.pages?.length ?? 0,
    };
  }

  private async pollOperation(operationLocation: string): Promise<AnalyzeOperationResponse> {
    for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt += 1) {
      const response = await fetch(operationLocation, {
        method: 'GET',
        headers: {
          'Ocp-Apim-Subscription-Key': this.config.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`Azure Document Intelligence polling failed with status ${response.status}.`);
      }

      const operation = await parseJsonResponse(response);

      if (operation.status === 'succeeded') {
        return operation;
      }

      if (operation.status === 'failed') {
        throw new Error(operation.error?.message ?? 'Azure Document Intelligence analysis failed.');
      }

      await sleep(POLL_INTERVAL_MS);
    }

    throw new Error('Azure Document Intelligence analysis timed out.');
  }
}
