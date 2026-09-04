import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PIPELINE_TIMEOUT_MS = 180_000;

function getProjectRoot(): string {
  // app/lib/etl/runPipelineServer.ts → repo root (works even if process.cwd() is wrong)
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

function formatPipelineError(stderr: string, exitCode: number, python: string): string {
  const trimmed = stderr.trim();
  if (trimmed.includes("No module named 'langgraph'")) {
    return [
      'LangGraph ist in der aktiven Python-Umgebung nicht installiert.',
      `Verwendeter Interpreter: ${python}`,
      "Fix: cd dppf-backend && .venv-langgraph/bin/pip install -e '.[dev]'",
      'Dann in .env.local: ETL_PYTHON=.venv-langgraph/bin/python und `npm run dev` neu starten.',
    ].join(' ');
  }
  if (trimmed) {
    try {
      const parsed = JSON.parse(trimmed) as { error?: string };
      if (parsed.error) {
        return parsed.error;
      }
    } catch {
      return trimmed;
    }
    return trimmed;
  }
  return `Pipeline failed (exit ${exitCode}).`;
}

export function runPipeline(payload: unknown): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const projectRoot = getProjectRoot();
  const python = resolvePythonExecutable(projectRoot);
  const cliScript = path.join(projectRoot, 'etl', 'run_pipeline_cli.py');

  return new Promise((resolve, reject) => {
    const child = spawn(python, [cliScript], {
      cwd: projectRoot,
      env: {
        ...process.env,
        PYTHONPATH: projectRoot,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill('SIGTERM');
        reject(new Error('Pipeline timeout (180s). Check OPENAI_API_KEY in .env.local.'));
      }
    }, PIPELINE_TIMEOUT_MS);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (error) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(error);
      }
    });
    child.on('close', (exitCode) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        if ((exitCode ?? 1) !== 0) {
          stderr = formatPipelineError(stderr, exitCode ?? 1, python);
        }
        resolve({ stdout, stderr, exitCode: exitCode ?? 1 });
      }
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}
