import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  getEtlProjectRoot,
  resolvePythonExecutable,
} from '@/app/lib/etl/resolvePythonExecutable';

describe('resolvePythonExecutable', () => {
  it('resolves project root from cwd', () => {
    const root = getEtlProjectRoot();
    expect(existsSync(path.join(root, 'etl', 'run_pipeline_cli.py'))).toBe(true);
  });

  it('prefers venv python over bare python3', () => {
    const root = getEtlProjectRoot();
    const python = resolvePythonExecutable(root);
    expect(python).toContain('.venv-langgraph');
    expect(existsSync(python)).toBe(true);
  });
});
