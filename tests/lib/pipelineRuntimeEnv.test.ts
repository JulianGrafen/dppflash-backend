import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import {
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
});
