import process from 'node:process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { isServerlessRuntime } from '@/app/lib/etl/runPipelineRemote';

/** Render/Docker production layout (see Dockerfile runner stage). */
export const DOCKER_ETL_ROOT = '/app';
export const DOCKER_ETL_PYTHON = '/app/.venv/bin/python';

const VENV_CANDIDATES = ['.venv-langgraph/bin/python', '.venv/bin/python'] as const;

const SYSTEM_PYTHON_CANDIDATES = [
  DOCKER_ETL_PYTHON,
  '/usr/bin/python3',
  '/usr/local/bin/python3.12',
  '/usr/local/bin/python3',
  '/opt/homebrew/bin/python3.12',
  '/opt/homebrew/bin/python3',
] as const;

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function getEtlProjectRoot(): string {
  const candidates: string[] = [];

  if (readEnv('NODE_ENV') === 'production') {
    candidates.push(DOCKER_ETL_ROOT);
  }

  candidates.push(process.cwd());

  try {
    candidates.push(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..'));
    candidates.push(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..'));
  } catch {
    // bundled without import.meta.url
  }

  for (const candidate of candidates) {
    if (
      existsSync(path.join(candidate, 'package.json')) &&
      existsSync(path.join(candidate, 'etl', 'run_pipeline_cli.py'))
    ) {
      return candidate;
    }
  }

  if (existsSync(path.join(DOCKER_ETL_ROOT, 'etl', 'run_pipeline_cli.py'))) {
    return DOCKER_ETL_ROOT;
  }

  return process.cwd();
}

export function resolvePythonExecutable(projectRoot: string): string {
  const tried: string[] = [];
  const fromEnv = readEnv('ETL_PYTHON');

  const pushCandidate = (candidate: string) => {
    if (!tried.includes(candidate)) {
      tried.push(candidate);
    }
  };

  // Production Docker (Render) — do not rely on PATH or bare `python3`.
  if (readEnv('NODE_ENV') === 'production') {
    pushCandidate(DOCKER_ETL_PYTHON);
  }

  if (fromEnv) {
    pushCandidate(path.isAbsolute(fromEnv) ? fromEnv : path.join(projectRoot, fromEnv));
    if (!path.isAbsolute(fromEnv)) {
      pushCandidate(path.join(process.cwd(), fromEnv));
    }
  }

  for (const relativePath of VENV_CANDIDATES) {
    pushCandidate(path.join(projectRoot, relativePath));
    pushCandidate(path.join(process.cwd(), relativePath));
  }

  for (const systemPython of SYSTEM_PYTHON_CANDIDATES) {
    pushCandidate(systemPython);
  }

  for (const candidate of tried) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  if (readEnv('NODE_ENV') === 'production') {
    throw new Error(
      `Python nicht gefunden in Production (spawn ENOENT). Versucht: ${tried.join(', ')}. ` +
        `Docker-Image muss ${DOCKER_ETL_PYTHON} enthalten (ETL_PYTHON=${readEnv('ETL_PYTHON') ?? 'unset'}).`,
    );
  }

  const suggested = path.join(projectRoot, '.venv-langgraph/bin/python');
  throw new Error(
    `Python nicht gefunden (spawn ENOENT). Versucht: ${tried.join(', ')}. ` +
      `Setze in .env.local: ETL_PYTHON=${suggested}`,
  );
}

export function describePythonResolution(): {
  readonly nodeEnv: string | undefined;
  readonly etlPythonEnv: string | undefined;
  readonly cwd: string;
  readonly serverless: boolean;
  readonly projectRoot: string;
  readonly resolvedPython: string | null;
  readonly pythonExists: boolean;
  readonly etlCliExists: boolean;
  readonly error: string | null;
} {
  const serverless = isServerlessRuntime();
  const projectRoot = getEtlProjectRoot();
  const etlCli = path.join(projectRoot, 'etl', 'run_pipeline_cli.py');
  let resolvedPython: string | null = null;
  let error: string | null = null;

  try {
    resolvedPython = resolvePythonExecutable(projectRoot);
  } catch (exc) {
    error = exc instanceof Error ? exc.message : String(exc);
  }

  return {
    nodeEnv: readEnv('NODE_ENV'),
    etlPythonEnv: readEnv('ETL_PYTHON'),
    cwd: process.cwd(),
    serverless,
    projectRoot,
    resolvedPython,
    pythonExists: resolvedPython ? existsSync(resolvedPython) : false,
    etlCliExists: existsSync(etlCli),
    error,
  };
}
