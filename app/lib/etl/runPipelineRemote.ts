import process from 'node:process';

import { buildPipelineRuntimeEnvRecord, readPipelineRuntimeEnv } from '@/app/lib/etl/pipelineRuntimeEnv';

const PIPELINE_TIMEOUT_MS = 180_000;

export function isServerlessRuntime(): boolean {
  const cwd = process.cwd();
  return (
    cwd.startsWith('/var/task') ||
    readPipelineRuntimeEnv('AWS_LAMBDA_FUNCTION_NAME') !== undefined ||
    readPipelineRuntimeEnv('AWS_EXECUTION_ENV') !== undefined ||
    readPipelineRuntimeEnv('VERCEL') === '1'
  );
}

export function readEtlServiceUrl(): string | undefined {
  return (
    readPipelineRuntimeEnv('ETL_SERVICE_URL') ?? readPipelineRuntimeEnv('ETL_REMOTE_URL')
  );
}

export function readEtlServiceSecret(): string | undefined {
  return readPipelineRuntimeEnv('ETL_SERVICE_SECRET');
}

export async function runPipelineRemote(
  payload: unknown,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const baseUrl = readEtlServiceUrl();
  if (!baseUrl) {
    throw new Error(
      'ETL_SERVICE_URL ist nicht gesetzt. Next.js läuft serverless ohne Python — ' +
        'deploye den ETL-Service (Dockerfile.etl) und setze ETL_SERVICE_URL auf dessen URL.',
    );
  }

  const secret = readEtlServiceSecret();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret) {
    headers.Authorization = `Bearer ${secret}`;
  }

  const body = {
    ...(typeof payload === 'object' && payload !== null ? payload : {}),
    _runtime_env: buildPipelineRuntimeEnvRecord(),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PIPELINE_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/run`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const responseBody = (await response.json()) as {
      result?: unknown;
      detail?: string;
      error?: string;
    };

    if (!response.ok) {
      const message =
        responseBody.detail ?? responseBody.error ?? `ETL service failed (${response.status}).`;
      return { stdout: '', stderr: message, exitCode: 1 };
    }

    return {
      stdout: JSON.stringify(responseBody.result ?? responseBody),
      stderr: '',
      exitCode: 0,
    };
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'AbortError'
        ? 'Pipeline timeout (180s) calling ETL service.'
        : error instanceof Error
          ? error.message
          : String(error);
    return { stdout: '', stderr: message, exitCode: 1 };
  } finally {
    clearTimeout(timer);
  }
}

export function describeEtlTransport(): {
  readonly serverless: boolean;
  readonly etlServiceUrl: string | null;
  readonly mode: 'remote' | 'local';
} {
  const remote = readEtlServiceUrl();
  const serverless = isServerlessRuntime();
  return {
    serverless,
    etlServiceUrl: remote ?? null,
    mode: remote || serverless ? 'remote' : 'local',
  };
}
