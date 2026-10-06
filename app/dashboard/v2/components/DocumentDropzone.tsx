'use client';

import { useCallback, useState } from 'react';
import { FileUp, Loader2 } from 'lucide-react';
import type { DraftDocument } from '@/app/dashboard/v2/mock/types';
import { Badge } from '@/components/ui/badge';

type DocumentDropzoneProps = {
  readonly documents: readonly DraftDocument[];
  readonly disabled?: boolean;
  readonly onFiles: (names: string[]) => void;
};

function statusLabel(status: DraftDocument['status']): string {
  switch (status) {
    case 'queued':
      return 'Warteschlange';
    case 'processing':
      return 'KI analysiert…';
    case 'done':
      return 'Verarbeitet';
    case 'error':
      return 'Fehler';
    default:
      return status;
  }
}

export function DocumentDropzone({ documents, disabled, onFiles }: DocumentDropzoneProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || disabled) {
        return;
      }
      const names = Array.from(fileList).map((f) => f.name);
      if (names.length > 0) {
        onFiles(names);
      }
    },
    [disabled, onFiles],
  );

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`cursor-pointer rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
          dragOver ? 'border-sky-500 bg-sky-50/50' : 'border-slate-300 bg-white'
        } ${disabled ? 'pointer-events-none opacity-60' : ''}`}
      >
        <FileUp className="mx-auto mb-3 h-10 w-10 text-sky-700" aria-hidden />
        <p className="text-sm font-semibold text-[#0c1929]">Dokumente hier ablegen</p>
        <p className="mt-1 text-xs text-slate-500">
          Datenblätter, SDS, Zertifikate, technische Unterlagen (Demo: beliebige Dateien)
        </p>
        <label className="mt-4 inline-block">
          <span className="rounded-lg bg-[#0c1929] px-4 py-2 text-sm font-semibold text-white">
            Dateien auswählen
          </span>
          <input
            type="file"
            multiple
            className="hidden"
            disabled={disabled}
            onChange={(e) => handleFiles(e.target.files)}
          />
        </label>
      </div>
      {documents.length > 0 ? (
        <ul className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="truncate font-medium text-slate-800">{doc.name}</span>
              <Badge variant="secondary" className="shrink-0 gap-1">
                {doc.status === 'processing' ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                ) : null}
                {statusLabel(doc.status)}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
