import { AIProvider, ProviderRegistry } from './aiProvider';
import { ProductPassport, AIExtractionOutput } from '../types/dpp-types';

/**
 * OpenAI Provider mit verbessertem Logging für Debugging.
 * 
 * Prinzipien:
 * - Clean Code: Klare Funktionen mit Single Responsibility
 * - DRY: Keine Code-Duplikation
 * - Comprehensive Logging: Alle Schritte dokumentiert
 * - Future-Proof: Erweiterbar und wartbar
 */

// ============= KONSTANTEN =============

const EXTRACTION_CONFIG = {
  OPENAI_MODEL: 'gpt-4o',
  MAX_TOKENS: 1024,
  THINKING_BETA: 'interleaved-thinking-2025-05-14',
  DEFAULT_CONFIDENCE: 0.8,
  DEFAULT_PRODUCT_TYPE: 'BATTERY' as const,
};

const SYSTEM_PROMPTS = {
  EXTRACTOR: `Du bist ein Experte für digitale Produktpässe (DPP) gemäß EU-ESPR.
Extrahiere strukturierte Daten aus technischen Dokumenten/Datenblättern.
WICHTIG: Antworte IMMER EXAKT als JSON-Objekt.
Wenn ein Feld nicht findbar ist, setze es auf null.
Füge ein confidence-Feld (0.0-1.0) hinzu für Unsicherheit.`,
};

const BATTERY_SCHEMA = {
  required: ['hersteller', 'modellname', 'kapazitaetKWh', 'chemischesSystem'],
};

const TEXTILE_SCHEMA = {
  required: ['hersteller', 'modellname', 'materialZusammensetzung', 'herkunftsland'],
};

const SCHEMA_BY_TYPE = {
  BATTERY: BATTERY_SCHEMA,
  TEXTILE: TEXTILE_SCHEMA,
};

// ============= UTILITIES =============

function logExtractionStep(
  step: string,
  details: Record<string, unknown>
): void {
  console.log(`📄 [${step}]:`, JSON.stringify(details, null, 2));
}

function parseJsonFromContent<T = Record<string, unknown>>(
  content: string
): { success: boolean; data: T | null; error: string | null } {
  logExtractionStep('PARSE_JSON_START', {
    contentLength: content.length,
    contentPreview: content.substring(0, 200),
  });

  if (!content) {
    return { success: false, data: null, error: 'Kein Content übergeben' };
  }

  // Versuche ganzen Content zu parsen
  try {
    const parsed = JSON.parse(content.trim());
    logExtractionStep('PARSE_JSON_SUCCESS_DIRECT', {
      keys: Object.keys(parsed),
    });
    return { success: true, data: parsed as T, error: null };
  } catch (e) {
    logExtractionStep('PARSE_JSON_DIRECT_FAILED', {
      error: e instanceof Error ? e.message : String(e),
    });
  }

  // Suche JSON-Block
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    logExtractionStep('PARSE_JSON_NO_BLOCK_FOUND', {
      content: content.substring(0, 500),
    });
    return {
      success: false,
      data: null,
      error: 'Kein JSON in Response gefunden',
    };
  }

  logExtractionStep('PARSE_JSON_BLOCK_FOUND', {
    blockLength: jsonMatch[0].length,
    blockPreview: jsonMatch[0].substring(0, 200),
  });

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    logExtractionStep('PARSE_JSON_SUCCESS_BLOCK', {
      keys: Object.keys(parsed),
      parsed,
    });
    return { success: true, data: parsed as T, error: null };
  } catch (err) {
    logExtractionStep('PARSE_JSON_BLOCK_FAILED', {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      success: false,
      data: null,
      error: `JSON Parse: ${err instanceof Error ? err.message : 'Unknown'}`,
    };
  }
}

function validateRequiredFields(
  data: Record<string, unknown> | null | undefined,
  requiredFields: string[]
): { isValid: boolean; missingFields: string[] } {
  if (!data) {
    return { isValid: false, missingFields: requiredFields };
  }

  const missingFields = requiredFields.filter(
    (field) => !data[field] || data[field] === ''
  );

  return { isValid: missingFields.length === 0, missingFields };
}

function buildExtractionPrompt(
  pdfText: string,
  productType: ProductPassport['type']
): string {
  const schema = SCHEMA_BY_TYPE[productType as keyof typeof SCHEMA_BY_TYPE];
  const requiredFields = schema.required.join(', ');

  return `Extrahiere alle Daten zu folgendem ${productType}-Produkt.

ERFORDERLICHE FELDER: ${requiredFields}

PDF-TEXT (erste 3000 Zeichen):
${pdfText.substring(0, 3000)}

WICHTIG:
1. Antworte NUR als JSON-Objekt (kein Markdown, kein Text)
2. Alle Felder müssen enthalten sein: ${requiredFields}
3. Feldnamen exakt wie oben (case-sensitive)
4. Felder auf null wenn nicht findbar
5. Füge confidence (0.0-1.0) hinzu
6. KEINE Erklärungen`;
}

// ============= OPENAI CLIENT =============

let openaiClient: any;

async function getOpenAIClient() {
  if (!openaiClient) {
    const OpenAI = (await import('openai')).default;
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

// ============= PROVIDER KLASSE =============

export class OpenAIDSGVOProvider implements AIProvider {
  async extractProductData(
    pdfText: string,
    productTypeHint?: ProductPassport['type']
  ): Promise<AIExtractionOutput> {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY nicht konfiguriert');
    }

    const productType = (productTypeHint ||
      EXTRACTION_CONFIG.DEFAULT_PRODUCT_TYPE) as ProductPassport['type'];

    logExtractionStep('EXTRACTION_START', { productType, pdfLength: pdfText.length });

    try {
      // OpenAI aufrufen
      const rawResponse = await this.callOpenAI(pdfText, productType);
      logExtractionStep('OPENAI_RESPONSE_RECEIVED', {
        length: rawResponse.length,
        preview: rawResponse.substring(0, 300),
      });

      // JSON parsen
      const parseResult = parseJsonFromContent<Record<string, unknown>>(
        rawResponse
      );

      if (!parseResult.success) {
        logExtractionStep('PARSE_FAILED', {
          error: parseResult.error,
          rawResponse: rawResponse.substring(0, 500),
        });
        throw new Error(`Parse Error: ${parseResult.error}`);
      }

      logExtractionStep('JSON_PARSED', {
        keys: Object.keys(parseResult.data || {}),
        data: parseResult.data,
      });

      // Felder validieren
      const schema = SCHEMA_BY_TYPE[productType as keyof typeof SCHEMA_BY_TYPE];
      const validation = validateRequiredFields(
        parseResult.data as Record<string, unknown>,
        schema.required
      );

      logExtractionStep('VALIDATION_RESULT', {
        isValid: validation.isValid,
        required: schema.required,
        missing: validation.missingFields,
        actualValues: Object.fromEntries(
          schema.required.map((f) => [f, parseResult.data?.[f] ?? 'NULL'])
        ),
      });

      const extractedFields = parseResult.data as Record<string, unknown>;
      const confidence = validation.isValid
        ? EXTRACTION_CONFIG.DEFAULT_CONFIDENCE
        : 0.5;

      const result: AIExtractionOutput = {
        productType,
        confidence,
        extractedFields,
        warnings: validation.missingFields.length > 0
          ? [`Missing fields: ${validation.missingFields.join(', ')}`]
          : [],
      };

      logExtractionStep('EXTRACTION_SUCCESS', {
        confidence,
        hersteller: result.extractedFields.hersteller,
        modellname: result.extractedFields.modellname,
      });

      return result;
    } catch (error) {
      logExtractionStep('EXTRACTION_FAILED', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async callOpenAI(
    pdfText: string,
    productType: ProductPassport['type']
  ): Promise<string> {
    const client = await getOpenAIClient();
    const userPrompt = buildExtractionPrompt(pdfText, productType);

    logExtractionStep('CALLING_OPENAI', {
      model: EXTRACTION_CONFIG.OPENAI_MODEL,
      promptLength: userPrompt.length,
      apiKeyExists: !!process.env.OPENAI_API_KEY,
    });

    try {
      const response = await client.beta.messages.create({
        model: EXTRACTION_CONFIG.OPENAI_MODEL,
        max_tokens: EXTRACTION_CONFIG.MAX_TOKENS,
        system: SYSTEM_PROMPTS.EXTRACTOR,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        // @ts-ignore experimental API
        betas: [EXTRACTION_CONFIG.THINKING_BETA],
      });

      logExtractionStep('OPENAI_RAW_RESPONSE', {
        responseLength: JSON.stringify(response).length,
        contentBlockCount: response.content.length,
        contentTypes: response.content.map((c: any) => c.type),
      });

      let textContent = '';
      for (const block of response.content) {
        if (block.type === 'text') {
          textContent = block.text;
          logExtractionStep('OPENAI_TEXT_BLOCK', {
            contentLength: (block.text as string).length,
            content: (block.text as string).substring(0, 500),
          });
          break;
        }
      }

      logExtractionStep('OPENAI_FINAL_TEXT', {
        textLength: textContent.length,
        firstChars: textContent.substring(0, 300),
      });

      return textContent;
    } catch (apiError) {
      logExtractionStep('OPENAI_API_ERROR', {
        error: apiError instanceof Error ? apiError.message : String(apiError),
        type: apiError instanceof Error ? apiError.constructor.name : typeof apiError,
      });
      throw apiError;
    }
  }

  async validateField(
    fieldName: string,
    value: unknown,
    _productType: ProductPassport['type']
  ): Promise<boolean> {
    const validators: Record<string, (v: unknown) => boolean> = {
      kapazitaetKWh: (v) => typeof v === 'number' && v > 0 && v < 10000,
      hersteller: (v) => typeof v === 'string' && v.trim().length > 0,
      modellname: (v) => typeof v === 'string' && v.trim().length > 0,
      materialZusammensetzung: (v) =>
        typeof v === 'string' && v.trim().length > 0,
      herkunftsland: (v) =>
        typeof v === 'string' && v.trim().length === 2,
    };

    const validator = validators[fieldName];
    return validator ? validator(value) : true;
  }

  async suggestAlternatives(
    message: string,
    context: Partial<ProductPassport>
  ): Promise<string[]> {
    const client = await getOpenAIClient();

    try {
      const response = await client.chat.completions.create({
        model: EXTRACTION_CONFIG.OPENAI_MODEL,
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: `${message}\n\nContext: ${JSON.stringify(context)}\n\nGive 2-3 suggestions as JSON array.`,
          },
        ],
      });

      const content = response.choices[0].message.content || '[]';
      const parseResult = parseJsonFromContent<string[]>(content);

      return parseResult.success && Array.isArray(parseResult.data)
        ? parseResult.data
        : [];
    } catch (error) {
      console.error('Error suggesting alternatives:', error);
      return [];
    }
  }
}

// Registriere Provider
ProviderRegistry.register('openai-dsgvo', new OpenAIDSGVOProvider());
