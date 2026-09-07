import { spawn } from 'node:child_process';
import path from 'node:path';

import { buildPipelineRuntimeEnvRecord, readPipelineRuntimeEnv } from '@/app/lib/etl/pipelineRuntimeEnv';
import {
  isServerlessRuntime,
  readEtlServiceSecret,
  readEtlServiceUrl,
} from '@/app/lib/etl/runPipelineRemote';
import { getEtlProjectRoot, resolvePythonExecutable } from '@/app/lib/etl/resolvePythonExecutable';

export async function runSmtpTest(toAddress: string): Promise<Record<string, unknown>> {
  const remoteUrl = readEtlServiceUrl();
  if (remoteUrl || isServerlessRuntime()) {
    if (!remoteUrl) {
      throw new Error('ETL_SERVICE_URL required for SMTP test in serverless production.');
    }
    const secret = readEtlServiceSecret();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (secret) {
      headers.Authorization = `Bearer ${secret}`;
    }
    const response = await fetch(`${remoteUrl.replace(/\/$/, '')}/test-smtp`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        to: toAddress,
        _runtime_env: buildPipelineRuntimeEnvRecord(),
      }),
    });
    return (await response.json()) as Record<string, unknown>;
  }

  const projectRoot = getEtlProjectRoot();
  const python = resolvePythonExecutable(projectRoot);
  const cliScript = path.join(projectRoot, 'etl', 'smtp_test_cli.py');

  return new Promise((resolve, reject) => {
    const child = spawn(python, [cliScript], {
      cwd: projectRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', reject);
    child.on('close', () => {
      try {
        resolve(JSON.parse(stdout || '{}') as Record<string, unknown>);
      } catch {
        reject(new Error(stderr.trim() || 'SMTP test failed.'));
      }
    });

    child.stdin.write(
      JSON.stringify({
        to: toAddress,
        _runtime_env: buildPipelineRuntimeEnvRecord(),
      }),
    );
    child.stdin.end();
  });
}
