import type { ComplianceLlmPort } from '@/app/application/ports/rag/ComplianceLlmPort';

/**
 * Returns minimal valid audit JSON for offline tests (no hallucinated business facts).
 */
export class MockComplianceLlm implements ComplianceLlmPort {
  readonly name = 'MockComplianceLlm';

  async completeJson(_systemPrompt: string, _userPrompt: string): Promise<string> {
    return JSON.stringify({});
  }
}
