import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';

import { buildPipelineRuntimeEnvRecord } from '@/app/lib/etl/pipelineRuntimeEnv';
import { getEtlProjectRoot, resolvePythonExecutable } from '@/app/lib/etl/resolvePythonExecutable';

export function runSmtpTest(toAddress: string): Promise<Record<string, unknown>> {
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
    child.on('error', (error) => {
      reject(
        new Error(
          error instanceof Error && error.message.includes('ENOENT')
            ? `Python nicht startbar (${python}). ${error.message}`
            : error instanceof Error
              ? error.message
              : String(error),
        ),
      );
    });
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
