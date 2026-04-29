import { loadAzureDppConfig } from '@/app/infrastructure/azure/azureConfig';
import { SerperSearchService } from '@/app/application/services/SerperSearchService';
import { SimpleReaderService } from '@/app/application/services/SimpleReaderService';

const MAX_WEB_CONTEXT_CHARS = 30_000;

interface AzureChatResponse {
  readonly choices?: readonly {
    readonly message?: {
      readonly content?: string;
    };
  }[];
}

interface EnrichmentPayload {
  readonly gtin?: string;
  readonly origin?: string;
  readonly confidence?: number;
}

export interface DppEnrichmentAgentInput {
  readonly productName: string;
  readonly manufacturer?: string;
}

export interface DppEnrichmentAgentResult {
  readonly gtin?: string;
  readonly origin?: string;
  readonly confidence: number;
  readonly sourceUrls: readonly string[];
}

function buildSystemPrompt(): string {
  return `Du bist ein Daten-Validierer. Ich habe ein Produkt aus einem Sicherheitsdatenblatt (SDB) und Informationen aus dem Web.
Aufgabe: Finde die GTIN und das Ursprungsland.
WICHTIG: Wenn die Web-Informationen zu einem anderen Produkt gehören (z.B. andere Größe oder Modell), ignoriere sie.
Antworte nur im JSON-Format: { gtin: string, origin: string, confidence: number }`;
}

function buildUserPrompt(productName: string, manufacturer: string | undefined, sourceUrls: readonly string[], webMarkdown: string): string {
  return `Produktname: ${productName}
Hersteller: ${manufacturer ?? 'unbekannt'}
Quellen:
${sourceUrls.map((url, index) => `${index + 1}. ${url}`).join('\n')}

Web-Inhalt (Markdown):
${webMarkdown.slice(0, MAX_WEB_CONTEXT_CHARS)}`;
}

function parseEnrichmentPayload(content: string): EnrichmentPayload {
  const parsed = JSON.parse(content) as unknown;

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Enrichment response must be a JSON object.');
  }

  const record = parsed as Record<string, unknown>;

  return {
    gtin: typeof record.gtin === 'string' && record.gtin.trim().length > 0 ? record.gtin.trim() : undefined,
    origin: typeof record.origin === 'string' && record.origin.trim().length > 0 ? record.origin.trim() : undefined,
    confidence: typeof record.confidence === 'number' && Number.isFinite(record.confidence)
      ? Math.max(0, Math.min(1, record.confidence))
      : undefined,
  };
}

function chatCompletionsUrl(): string {
  const config = loadAzureDppConfig().openAi;
  return `${config.endpoint}/openai/deployments/${encodeURIComponent(config.deploymentName)}/chat/completions?api-version=${encodeURIComponent(config.apiVersion)}`;
}

export class DppEnrichmentAgent {
  static async enrich(input: DppEnrichmentAgentInput): Promise<DppEnrichmentAgentResult> {
    const productName = input.productName.trim();

    if (!productName) {
      throw new Error('productName is required for DppEnrichmentAgent.');
    }

    const manufacturer = input.manufacturer;
    const urls = await SerperSearchService.findProductLinks(productName);

    if (urls.length === 0) {
      return {
        confidence: 0,
        sourceUrls: [],
      };
    }

    const pageReads = await Promise.allSettled(urls.map((url) => SimpleReaderService.readUrl(url)));
    const markdownParts = pageReads.flatMap((result, index) => {
      if (result.status !== 'fulfilled' || !result.value.trim()) {
        return [];
      }

      return [`## Source ${index + 1}\n${result.value}`];
    });

    if (markdownParts.length === 0) {
      return {
        confidence: 0,
        sourceUrls: urls,
      };
    }

    const openAiConfig = loadAzureDppConfig().openAi;
    const response = await fetch(chatCompletionsUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': openAiConfig.apiKey,
      },
      body: JSON.stringify({
        model: openAiConfig.modelName,
        response_format: { type: 'json_object' },
        temperature: 0,
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          {
            role: 'user',
            content: buildUserPrompt(productName, manufacturer, urls, markdownParts.join('\n\n')),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`DppEnrichmentAgent Azure request failed with status ${response.status}.`);
    }

    const payload = await response.json() as AzureChatResponse;
    const content = payload.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('DppEnrichmentAgent received empty response content.');
    }

    const enrichment = parseEnrichmentPayload(content);

    return {
      gtin: enrichment.gtin,
      origin: enrichment.origin,
      confidence: enrichment.confidence ?? 0,
      sourceUrls: urls,
    };
  }
}
