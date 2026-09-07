import process from 'node:process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VENV_CANDIDATES = ['.venv-langgraph/bin/python', '.venv/bin/python'] as const;

const SYSTEM_PYTHON_CANDIDATES = [
  '/opt/homebrew/bin/python3.12',
  '/opt/homebrew/bin/python3',
  '/usr/local/bin/python3.12',
  '/usr/local/bin/python3',
  '/usr/bin/python3',
] as const;

export function getEtlProjectRoot(): string {
  const candidates = [
    process.cwd(),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..'),
  ];

  for (const candidate of candidates) {
    if (
      existsSync(path.join(candidate, 'package.json')) &&
      existsSync(path.join(candidate, 'etl', 'run_pipeline_cli.py'))
    ) {
      return candidate;
    }
  }

  return process.cwd();
}

export function resolvePythonExecutable(projectRoot: string): string {
  const tried: string[] = [];
  const fromEnv = process.env['ETL_PYTHON']?.trim();

  const pushCandidate = (candidate: string) => {
    if (!tried.includes(candidate)) {
      tried.push(candidate);
    }
  };

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

  const suggested = path.join(projectRoot, '.venv-langgraph/bin/python');
  throw new Error(
    `Python nicht gefunden (spawn ENOENT). Versucht: ${tried.join(', ')}. ` +
      `Setze in .env.local: ETL_PYTHON=${suggested}`,
  );
}
