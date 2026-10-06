import type { DraftDocument, DraftPassport } from './types';
import { applyExtractionToDraft } from './batteryWizardFixture';
import { runIngestQueue } from './ingest/runIngestQueue';

function docId(): string {
  return `doc_${Math.random().toString(36).slice(2, 10)}`;
}

export async function simulateDocumentPipeline(
  draft: DraftPassport,
  fileNames: string[],
  onUpdate: (draft: DraftPassport) => void,
): Promise<DraftPassport> {
  const pseudoFiles = fileNames.map(
    (name) =>
      new File(['mock'], name, {
        type: name.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream',
      }),
  );

  const queued = await runIngestQueue(draft, pseudoFiles, (updated) => {
    onUpdate(updated);
  });

  const extracted = applyExtractionToDraft({
    ...queued,
    fields: queued.fields.length > 0 ? queued.fields : applyExtractionToDraft(queued).fields,
  });
  onUpdate(extracted);
  return extracted;
}

export function seedDocumentsForImport(): DraftDocument[] {
  return [
    { id: docId(), name: 'stammdaten_import.csv', type: 'CSV', status: 'done' },
  ];
}
