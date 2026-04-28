export interface AzureDocumentIntelligenceConfig {
  readonly endpoint: string;
  readonly apiKey: string;
  readonly apiVersion: string;
  readonly modelId: string;
}

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
  readonly documentIntelligence: AzureDocumentIntelligenceConfig;
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

export function loadAzureDppConfig(): AzureDppConfig {
  return {
    region: 'germanywestcentral',
    documentIntelligence: {
      endpoint: trimTrailingSlash(readRequiredEnv('AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT')),
      apiKey: readRequiredEnv('AZURE_DOCUMENT_INTELLIGENCE_API_KEY'),
      apiVersion: process.env.AZURE_DOCUMENT_INTELLIGENCE_API_VERSION ?? '2024-11-30',
      modelId: process.env.AZURE_DOCUMENT_INTELLIGENCE_MODEL_ID ?? 'prebuilt-layout',
    },
    openAi: {
      endpoint: trimTrailingSlash(readRequiredEnv('AZURE_OPENAI_ENDPOINT')),
      apiKey: readRequiredEnv('AZURE_OPENAI_API_KEY'),
      apiVersion: process.env.AZURE_OPENAI_API_VERSION ?? '2024-10-21',
      deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4o',
      modelName: 'gpt-4o',
    },
  };
}
