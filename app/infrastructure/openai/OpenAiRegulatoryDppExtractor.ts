import OpenAI from 'openai';
import type {
  RegulatoryStructuredDppExtractionPort,
  RegulatoryStructuredDppExtractionInput,
} from '@/app/application/ports/RegulatoryStructuredDppExtractionPort';
import { DppExtractionSchema } from '@/app/domain/dpp/dppExtractionZodSchema';
import { readPdfPerPage } from '@/app/utils/pdfReader';
import type { SafeLoggerPort } from '@/app/application/ports/SafeLoggerPort';
import { REGULATORY_DPP_SYSTEM_PROMPT } from '@/app/infrastructure/openai/regulatoryDppExtractionPrompt';

const MAX_DOC_CHARS = 100_000;

export interface OpenAiRegulatoryDppExtractorOptions {
  readonly apiKey: string;
  readonly model?: string;
  readonly logger?: SafeLoggerPort;
}

export class OpenAiRegulatoryDppExtractor implements RegulatoryStructuredDppExtractionPort {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly logger?: SafeLoggerPort;

  constructor(options: OpenAiRegulatoryDppExtractorOptions) {
    this.client = new OpenAI({ apiKey: options.apiKey });
    this.model = options.model ?? process.env.OPENAI_REGULATORY_MODEL ?? 'gpt-4o-mini';
    this.logger = options.logger;
  }

  async extract(input: RegulatoryStructuredDppExtractionInput) {
    const pages = await readPdfPerPage(input.pdf, input.sourcePdf);
    const body = pages
      .map((p) => `\n--- Page ${p.pageNumber} ---\n${p.text}`)
      .join('\n')
      .slice(0, MAX_DOC_CHARS);

    const userPayload = {
      sourcePdfFileName: input.sourcePdf,
      pages: pages.length,
      documentTextWithPageMarkers: body,
    };

    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: REGULATORY_DPP_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            'Extract the regulated JSON. Field names and nesting:',
            JSON.stringify(
              {
                productIdentification: ['model', 'sku', 'batchId', 'digitalLink'],
                economicOperator: ['manufacturer', 'importer', 'contactDetails'],
                materialCompositionAndSubstances: {
                  materials: [{ name: {}, sharePercent: {}, recycledOrVirginNote: {} }],
                  chemicalDeclarations: [],
                },
                environmentalFootprint: {
                  totalCo2eKg: {},
                  energySourcesPercent: [{ sourceLabel: {}, percent: {} }],
                },
                complianceAndCertifications: { certificates: [{ scheme: {}, certificateId: {} }] },
                circularityEndOfLife: ['repairLinks', 'recyclabilityInstructions', 'lifecycleYears'],
                compositionGraph: { nodes: [], links: [] },
              },
              null,
              2,
            ),
            '',
            'Document:',
            JSON.stringify(userPayload),
          ].join('\n'),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      throw new Error('OpenAI regulatory extraction: empty model response.');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      throw new Error('OpenAI regulatory extraction: response is not valid JSON.');
    }

    const result = DppExtractionSchema.safeParse(parsed);
    if (!result.success) {
      this.logger?.warn('regulatory_dpp_schema_failed', {
        issueCount: result.error.issues.length,
        firstIssue: result.error.issues[0]?.message ?? 'unknown',
      });
      throw new Error(`Regulatory DPP JSON failed schema validation: ${result.error.message}`);
    }

    return result.data;
  }
}
