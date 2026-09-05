import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import {
  buildPipelineEnvDiagnostics,
  buildPipelineRuntimeEnvRecord,
  readPipelineRuntimeEnv,
} from '@/app/lib/etl/pipelineRuntimeEnv';

describe('pipelineRuntimeEnv', () => {
  beforeEach(() => {
    process.env.SUPPLIER_OUTREACH_SECRET = ' runtime-secret ';
  });

  afterEach(() => {
    delete process.env.SUPPLIER_OUTREACH_SECRET;
  });

  it('reads env vars with dynamic keys and trims whitespace', () => {
    expect(readPipelineRuntimeEnv('SUPPLIER_OUTREACH_SECRET')).toBe('runtime-secret');
  });

  it('includes configured outreach vars in runtime payload', () => {
    const runtime = buildPipelineRuntimeEnvRecord();
    expect(runtime.SUPPLIER_OUTREACH_SECRET).toBe('runtime-secret');
  });

  it('reports diagnostics without exposing secret values', () => {
    const diagnostics = buildPipelineEnvDiagnostics();
    expect(diagnostics.nodeHasOutreachSecret).toBe(true);
    expect(diagnostics.forwardedKeys).toContain('SUPPLIER_OUTREACH_SECRET');
  });
});
