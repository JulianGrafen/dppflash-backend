import type { DraftDocument, DraftPassport } from '../types';
import { applyIngestToPassportFields } from './applyIngestToPassportFields';
import { buildFileMockPatches } from './fileMockPatches';
import { routeFileByMime } from './routeFileByMime';
import { DEMO_FOLDER_FILE_LIMIT } from './types';

function docId(): string {
  return `doc_${Math.random().toString(36).slice(2, 10)}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export type IngestQueueProgress = {
  processed: number;
  total: number;
  currentFile?: string;
};

export async function runIngestQueue(
  draft: DraftPassport,
  files: File[],
  onUpdate: (draft: DraftPassport, progress: IngestQueueProgress) => void,
): Promise<DraftPassport> {
  const limited = files.slice(0, DEMO_FOLDER_FILE_LIMIT);
  const total = limited.length;

  let passportFields = { ...draft.passportFields };
  let documents: DraftDocument[] = limited.map((f) => ({
    id: docId(),
    name: f.name,
    type: f.name.split('.').pop()?.toUpperCase() ?? 'FILE',
    status: 'queued' as const,
  }));

  let current: DraftPassport = { ...draft, documents, passportFields };
  onUpdate(current, { processed: 0, total });

  for (let i = 0; i < limited.length; i++) {
    const file = limited[i]!;
    const doc = documents[i]!;
    documents = documents.map((d) => (d.id === doc.id ? { ...d, status: 'processing' } : d));
    current = { ...current, documents };
    onUpdate(current, { processed: i, total, currentFile: file.name });

    await delay(200 + Math.random() * 300);

    const route = routeFileByMime(file.name, file.type);
    if (route === 'unsupported') {
      documents = documents.map((d) => (d.id === doc.id ? { ...d, status: 'error' } : d));
    } else {
      const patch = buildFileMockPatches(file.name, route);
      passportFields = applyIngestToPassportFields(passportFields, patch, {
        source: 'file',
        structured: route === 'spreadsheet' || route === 'json',
      });
      documents = documents.map((d) => (d.id === doc.id ? { ...d, status: 'done' } : d));
    }

    current = {
      ...current,
      documents,
      passportFields,
      updatedAt: new Date().toISOString(),
    };
    onUpdate(current, { processed: i + 1, total, currentFile: file.name });
  }

  return current;
}
