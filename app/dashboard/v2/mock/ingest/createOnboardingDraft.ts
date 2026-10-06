import { createEmptyDraft } from '../batteryWizardFixture';
import type { DraftField } from '../types';
import { upsertDraft } from '../storage';
import type { DraftPassport } from '../types';
import { applyIngestToPassportFields } from './applyIngestToPassportFields';
import { runGapFillExtraction } from './gapFillExtraction';
import { buildPimMockPatches } from './pimMockPatches';
import { buildSapMockPatches } from './sapMockPatches';
import { runIngestQueue } from './runIngestQueue';

function legacyIdFields(): DraftField[] {
  return [
    {
      path: 'productNumber',
      label: 'SKU',
      block: 'identification',
      value: 'TV-NMC-52-001',
      provenance: 'ai',
      confidence: 0.96,
      critical: true,
    },
    {
      path: 'gtin',
      label: 'GTIN',
      block: 'identification',
      value: '4260123456789',
      provenance: 'ai',
      confidence: 0.94,
      critical: false,
    },
  ];
}

export async function buildOnboardingDraft(params: {
  tenantId: string;
  sapHost?: string;
  files: File[];
  autoGapFill: boolean;
}): Promise<DraftPassport> {
  let draft = createEmptyDraft(`onboard_${params.tenantId}`, 'existing');
  draft.productName = 'PowerCell Pro NMC 5.2 kWh Modul';
  draft.fields = legacyIdFields();

  let fields = draft.passportFields ?? {};
  fields = applyIngestToPassportFields(fields, buildSapMockPatches(params.sapHost), {
    source: 'sap_mock',
    structured: true,
  });
  fields = applyIngestToPassportFields(fields, buildPimMockPatches(params.tenantId), {
    source: 'pim_mock',
    structured: true,
  });
  draft = { ...draft, passportFields: fields };

  if (params.files.length > 0) {
    draft = await runIngestQueue(draft, params.files, (updated) => {
      draft = updated;
    });
  }

  if (params.autoGapFill) {
    const filled = await runGapFillExtraction(draft.passportFields ?? {});
    draft = { ...draft, passportFields: filled };
  }

  draft.updatedAt = new Date().toISOString();
  draft.visitedSteps = [...new Set([...draft.visitedSteps, 'upload', 'review-data'])];
  upsertDraft(draft);
  return draft;
}
