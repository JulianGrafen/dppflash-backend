import OpenAI from 'openai';
import type { DocumentPrimaryProductNameInferencerPort } from '@/app/application/ports/rag/DocumentPrimaryProductNameInferencerPort';

/**
 * Single fast JSON-object completion to label the main product in an SDB / price list excerpt.
 */
export class OpenAiDocumentPrimaryProductNameInferencer implements DocumentPrimaryProductNameInferencerPort {
  readonly name = 'OpenAiDocumentPrimaryProductNameInferencer';

  private readonly client: OpenAI;

  private readonly model: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required for OpenAiDocumentPrimaryProductNameInferencer.');
    }
    this.client = new OpenAI({ apiKey });
    this.model = process.env.OPENAI_DOCUMENT_PRODUCT_MODEL ?? 'gpt-4o-mini';
  }

  async inferPrimaryProductName(documentTextExcerpt: string): Promise<string | null> {
    const text = documentTextExcerpt.trim().slice(0, 14_000);
    if (!text) {
      return null;
    }

    const response = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Antworte nur mit JSON: {"primaryProductName": string | null}. ' +
            'primaryProductName = eine kompakte Handels-/Produktbezeichnung (kein reiner Firmenname allein). ' +
            'Wenn unklar oder mehrere gleichwertige Produkte, null.',
        },
        {
          role: 'user',
          content: text,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) {
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      return null;
    }

    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    const v = (parsed as { primaryProductName?: unknown }).primaryProductName;
    if (v === null || v === undefined) {
      return null;
    }
    if (typeof v !== 'string') {
      return null;
    }
    const t = v.trim();
    return t.length > 0 ? t.slice(0, 512) : null;
  }
}
