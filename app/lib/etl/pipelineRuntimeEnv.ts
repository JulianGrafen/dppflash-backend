import process from 'node:process';

/**
 * Runtime env for the Python LangGraph subprocess.
 *
 * Always read via `node:process` — bundled Next.js shims may not expose Render
 * secrets through a spread of `process.env`.
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
  'SMTP_USE_SSL',
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
  return Object.assign({}, process.env, { PYTHONPATH: projectRoot });
}

export function isSupplierOutreachSecretConfigured(): boolean {
  return readPipelineRuntimeEnv('SUPPLIER_OUTREACH_SECRET') !== undefined;
}

export function buildPipelineEnvDiagnostics(): {
  readonly nodeHasOutreachSecret: boolean;
  readonly forwardedKeys: readonly string[];
} {
  const runtime = buildPipelineRuntimeEnvRecord();
  return {
    nodeHasOutreachSecret: isSupplierOutreachSecretConfigured(),
    forwardedKeys: Object.keys(runtime),
  };
}