import process from 'node:process';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildPipelineRuntimeEnvRecord } from '@/app/lib/etl/pipelineRuntimeEnv';

function getProjectRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
}

function resolvePythonExecutable(projectRoot: string): string {
  const fromEnv = process.env.ETL_PYTHON?.trim();
  if (fromEnv) {
    return path.isAbsolute(fromEnv) ? fromEnv : path.join(projectRoot, fromEnv);
  }
  for (const relativePath of ['.venv-langgraph/bin/python', '.venv/bin/python']) {
    const candidate = path.join(projectRoot, relativePath);
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return 'python3';
}

export function runSmtpTest(toAddress: string): Promise<Record<string, unknown>> {
  const projectRoot = getProjectRoot();
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
