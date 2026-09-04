/**
 * Runtime env for the Python LangGraph subprocess.
 *
 * Use dynamic `process.env[key]` lookups so Next.js does not inline undefined
 * values from the Docker build stage into the production bundle.
 */
const PIPELINE_ENV_KEYS = [
  'OPENAI_API_KEY',
  'SUPPLIER_OUTREACH_SECRET',
  'SUPPLIER_OUTREACH_ENABLED',
  'SUPPLIER_OUTREACH_FROM',
  'SUPPLIER_OUTREACH_MOCK_SUCCESS',
  'NEXT_PUBLIC_DPP_URL',
  'NEXT_PUBLIC_APP_URL',
  'RENDER_EXTERNAL_URL',
  'VERCEL_URL',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'SMTP_FROM',
  'SMTP_USE_TLS',
  'SPHIER_API_ENABLED',
] as const;

export function readPipelineRuntimeEnv(name: string): string | undefined {
  const value = process.env[name];
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function buildPipelineRuntimeEnvRecord(): Record<string, string> {
  const runtime: Record<string, string> = {};
  for (const key of PIPELINE_ENV_KEYS) {
    const value = readPipelineRuntimeEnv(key);
    if (value !== undefined) {
      runtime[key] = value;
    }
  }
  return runtime;
}

export function buildPipelineSubprocessEnv(projectRoot: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, PYTHONPATH: projectRoot };
  for (const key of PIPELINE_ENV_KEYS) {
    const value = readPipelineRuntimeEnv(key);
    if (value !== undefined) {
      env[key] = value;
    }
  }
  return env;
}

export function isSupplierOutreachSecretConfigured(): boolean {
  return readPipelineRuntimeEnv('SUPPLIER_OUTREACH_SECRET') !== undefined;
}
