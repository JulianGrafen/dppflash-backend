export interface AzureOpenAiConfig {
  readonly endpoint: string;
  readonly apiKey: string;
  readonly apiVersion: string;
  readonly deploymentName: string;
  readonly modelName: 'gpt-4o';
}

export interface AzureRegionConfig {
  readonly region: 'germanywestcentral';
}

export interface AzureDppConfig {
  readonly region: AzureRegionConfig['region'];
  readonly openAi: AzureOpenAiConfig;
}

function readRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Environment variable ${name} is required for Azure DPP extraction.`);
  }

  return value;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export function normalizeAzureOpenAiEndpoint(value: string): string {
  try {
    const parsed = new URL(value);
    return trimTrailingSlash(parsed.origin);
  } catch {
    throw new Error(
      'AZURE_OPENAI_ENDPOINT must be a valid URL like https://<resource>.openai.azure.com',
    );
  }
}

/** Optional: eigenes Deployment für RAG-Compliance-JSON; sonst {@link AzureOpenAiConfig.deploymentName}. */
export interface AzureOpenAiComplianceChatConfig {
  readonly endpoint: string;
  readonly apiKey: string;
  readonly apiVersion: string;
  readonly deploymentName: string;
  /** Request-Body `model` (Azure erwartet i. d. R. das Modell des Deployments). */
  readonly modelName: string;
}

/**
 * Liefert Konfiguration für Chat-Completions (z. B. Gap-Targeted RAG), wenn alle nötigen Env-Variablen gesetzt sind.
 * Kein Throw — bei fehlenden Werten `null` (Caller fällt z. B. auf Mock zurück).
 */
export function tryLoadAzureOpenAiComplianceChatConfig(): AzureOpenAiComplianceChatConfig | null {
  const endpointRaw = process.env.AZURE_OPENAI_ENDPOINT?.trim();
  const apiKey = process.env.AZURE_OPENAI_API_KEY?.trim();
  const deploymentName =
    process.env.AZURE_OPENAI_COMPLIANCE_DEPLOYMENT?.trim() ||
    process.env.AZURE_OPENAI_DEPLOYMENT?.trim();

  if (!endpointRaw || !apiKey || !deploymentName) {
    return null;
  }

  let endpoint: string;
  try {
    endpoint = normalizeAzureOpenAiEndpoint(endpointRaw);
  } catch {
    return null;
  }

  return {
    endpoint,
    apiKey,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION?.trim() ?? '2024-10-21',
    deploymentName,
    modelName: process.env.AZURE_OPENAI_COMPLIANCE_MODEL?.trim() ?? 'gpt-4o',
  };
}

export function loadAzureDppConfig(): AzureDppConfig {
  return {
    region: 'germanywestcentral',
    openAi: {
      endpoint: normalizeAzureOpenAiEndpoint(readRequiredEnv('AZURE_OPENAI_ENDPOINT')),
      apiKey: readRequiredEnv('AZURE_OPENAI_API_KEY'),
      apiVersion: process.env.AZURE_OPENAI_API_VERSION ?? '2024-10-21',
      deploymentName: readRequiredEnv('AZURE_OPENAI_DEPLOYMENT'),
      modelName: 'gpt-4o',
    },
  };
}
