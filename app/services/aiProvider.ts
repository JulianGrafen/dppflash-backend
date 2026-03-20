import { ProductPassport, AIExtractionOutput } from '../types/dpp-types';

/**
 * KI-Provider Interface – Abstraktion für verschiedene LLM-Backend.
 * 
 * Architektur-Vorteil:
 * - Wechsel zwischen OpenAI (Cloud) ↔ Ollama (On-Premise) ohne Code-Änderungen
 * - Futureproof: Erweiterbar für weitere Provider (Anthropic, local models)
 * - DSGVO-konform: Lokale Verarbeitung + sichere Remote-Optionen
 */

export interface AIProvider {
  /**
   * Extrahiert strukturierte DPP-Daten aus unverarbeiteten PDF-Text.
   * 
   * @param pdfText - Rohtext aus PDF (lokal extrahiert)
   * @param productTypeHint - Optional: Vermutete Produktkategorie (BATTERY|TEXTILE)
   * @returns Strukturierte Daten oder Fehler
   */
  extractProductData(
    pdfText: string,
    productTypeHint?: ProductPassport['type']
  ): Promise<AIExtractionOutput>;

  /**
   * Validiert, ob ein Feld plausibel ist (z.B. realistische CO2-Werte).
   */
  validateField(
    fieldName: string,
    value: unknown,
    productType: ProductPassport['type']
  ): Promise<boolean>;

  /**
   * Human-in-the-Loop: Fragt LLM um Alternativen bei Unsicherheit.
   */
  suggestAlternatives(
    message: string,
    context: Partial<ProductPassport>
  ): Promise<string[]>;
}

/**
 * Provider-Registry für zentrale Verwaltung.
 */
export class ProviderRegistry {
  private static providers: Map<string, AIProvider> = new Map();

  static register(name: string, provider: AIProvider): void {
    this.providers.set(name, provider);
  }

  static getProvider(name: string): AIProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`AI-Provider "${name}" nicht registriert`);
    }
    return provider;
  }

  static getActive(): AIProvider {
    // Priorität: 1) Env-Variable, 2) Fallback zu OpenAI wenn API-Key vorhanden, 3) Fallback zu Mock-Local
    const configuredProvider = process.env.AI_PROVIDER;
    if (configuredProvider) {
      return this.getProvider(configuredProvider);
    }

    // Auto-Fallback: Wenn OPENAI_API_KEY nicht gesetzt, nutze Mock-Local
    const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY);
    const activeProvider = hasOpenAIKey ? 'openai-dsgvo' : 'mock-local';

    console.log(`🤖 AI-Provider: ${activeProvider} (OpenAI-Key: ${hasOpenAIKey ? 'ja' : 'nein'})`);
    return this.getProvider(activeProvider);
  }
}

// ============= PROVIDER INITIALIZATION =============

// Registriere alle verfügbaren Provider beim Start
import { MockLocalProvider } from './mockLocalProvider';

ProviderRegistry.register('mock-local', new MockLocalProvider());

// OpenAI Provider wird von openaiProvider.ts selbst registriert
// wenn OPENAI_API_KEY vorhanden ist
