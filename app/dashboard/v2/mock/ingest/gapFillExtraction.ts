import { computePassportCompleteness } from '../passportCompleteness';
import { applyIngestToPassportFields } from './applyIngestToPassportFields';
import type { IngestPatchMap } from './types';
import type { PassportFieldValueState } from '../types';

const GAP_FILL_VALUES: Record<string, { value: string; confidence: number }> = {
  'battery.category': { value: 'LMT', confidence: 0.74 },
  'battery.rechargeable': { value: 'true', confidence: 0.82 },
  'labelling.separateCollectionSymbol': { value: 'true', confidence: 0.71 },
  'carbonFootprint.stageRawMaterial': { value: '22', confidence: 0.68 },
  'carbonFootprint.stageProduction': { value: '18', confidence: 0.67 },
  'carbonFootprint.stageDistribution': { value: '6', confidence: 0.66 },
  'carbonFootprint.stageEndOfLife': { value: '12', confidence: 0.65 },
  'repair.disassemblyInstructions': {
    value: 'Remove service cover — disconnect HV according to OEM manual.',
    confidence: 0.7,
  },
  'endOfLife.collectionInfo': {
    value: 'Return to authorized collection point or manufacturer take-back.',
    confidence: 0.69,
  },
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function listMandatoryGapKeys(fields: Record<string, PassportFieldValueState>): string[] {
  const summary = computePassportCompleteness(fields);
  return summary.blockers.map((b) => b.key);
}

export async function runGapFillExtraction(
  fields: Record<string, PassportFieldValueState>,
  options?: { maxKeys?: number; onProgress?: (key: string) => void },
): Promise<Record<string, PassportFieldValueState>> {
  const gapKeys = listMandatoryGapKeys(fields).slice(0, options?.maxKeys ?? 12);
  let next = fields;

  for (const key of gapKeys) {
    options?.onProgress?.(key);
    await delay(120);
    const preset = GAP_FILL_VALUES[key];
    const patch: IngestPatchMap = {
      [key]: preset
        ? {
            value: preset.value,
            confidence: preset.confidence,
            provenance: 'ai',
            source: {
              kind: 'pdf',
              documentTitle: 'KI-Lückenfüllung (Demo)',
              documentId: 'gap-fill-mock',
              locationLabel: `Vorgeschlagener Wert für ${key}`,
              contextSnippet: preset.value,
            },
          }
        : {
            value: `Demo-Wert für ${key}`,
            confidence: 0.66,
            provenance: 'ai',
            source: {
              kind: 'pdf',
              documentTitle: 'KI-Lückenfüllung (Demo)',
              documentId: 'gap-fill-mock',
              locationLabel: key,
              contextSnippet: `Suggested value for mandatory field ${key}`,
            },
          },
    };
    next = applyIngestToPassportFields(next, patch, { source: 'file', structured: false });
  }

  return next;
}
