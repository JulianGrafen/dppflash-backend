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
  readonly requiresManualReview?: boolean;
  readonly reviewReason?: string | null;
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
  readonly requiresManualReview: boolean;
  readonly reviewReason: string | null;
}

const ENRICHMENT_SYSTEM_PROMPT = (productName: string, manufacturer: string, n: number) => `Du bist ein extrem strenger Compliance-Auditor für Produktdaten.
Zielprodukt: '${productName}' von '${manufacturer}'.
Du erhältst unstrukturierten Text von ${n} Webseiten-Scrapes.

REGELN:

EXACT MATCH VERIFICATION: Prüfe zwingend, ob der Text exakt das Zielprodukt beschreibt. Wenn der Text Varianten wie 'Stark', 'Mega' oder 'Naturstein' behandelt, IGNORIERE DIESE DATEN KOMPLETT.

KEINE KOMPROMISSE: Eine falsche GTIN führt zu rechtlichen Konsequenzen. Wenn du dir nicht zu 100 % sicher bist, dass die gefundene GTIN exakt zum Zielprodukt gehört, setze gtin auf null.

REVIEW FLAG: Wenn du eine GTIN findest, der Text aber auch andere Produktvarianten erwähnt, oder wenn du Quellen kombinieren musstest, setze 'requiresManualReview' zwingend auf true und erkläre den Grund in 'reviewReason'.

GTIN/EAN-REGEL:
- Suche explizit nach Kennzeichnungen wie "GTIN", "EAN" oder "Barcode".
- Bevorzuge Treffer mit 13 Ziffern (typische EAN/GTIN im EU-Handel) gegenüber kurzen internen Nummern.
- Interne Artikelnummern/SKU/Art.-Nr./Bestellnummer sind keine GTIN und dürfen nicht als gtin ausgegeben werden.

Gib ausschließlich valides JSON zurück.`;

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
  const rawGtin = typeof record.gtin === 'number'
    ? String(Math.trunc(record.gtin))
    : typeof record.gtin === 'string'
      ? record.gtin
      : '';
  const gtin = normalizeGtin(rawGtin);

  return {
    gtin,
    origin: typeof record.origin === 'string' && record.origin.trim().length > 0 ? record.origin.trim() : undefined,
    confidence: typeof record.confidence === 'number' && Number.isFinite(record.confidence)
      ? Math.max(0, Math.min(1, record.confidence))
      : undefined,
    requiresManualReview: typeof record.requiresManualReview === 'boolean' ? record.requiresManualReview : undefined,
    reviewReason: typeof record.reviewReason === 'string' && record.reviewReason.trim().length > 0
      ? record.reviewReason.trim()
      : null,
  };
}

function normalizeGtin(value: string): string | undefined {
  const compact = value.trim();
  if (!compact) {
    return undefined;
  }

  const digitsOnly = compact.replace(/\D/g, '');
  if (/^\d{8}$|^\d{13}$|^\d{14}$/.test(digitsOnly)) {
    return digitsOnly;
  }

  return undefined;
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
        requiresManualReview: false,
        reviewReason: null,
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
        requiresManualReview: false,
        reviewReason: null,
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
          { role: 'system', content: ENRICHMENT_SYSTEM_PROMPT(productName, manufacturer ?? 'unbekannt', markdownParts.length) },
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
      requiresManualReview: enrichment.requiresManualReview ?? false,
      reviewReason: enrichment.reviewReason ?? null,
    };
  }
}
