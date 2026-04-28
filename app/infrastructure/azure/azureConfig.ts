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

function normalizeAzureOpenAiEndpoint(value: string): string {
  try {
    const parsed = new URL(value);
    return trimTrailingSlash(parsed.origin);
  } catch {
    throw new Error(
      'AZURE_OPENAI_ENDPOINT must be a valid URL like https://<resource>.openai.azure.com',
    );
  }
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
