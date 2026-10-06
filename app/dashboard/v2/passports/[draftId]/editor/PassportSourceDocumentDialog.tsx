'use client';

import type { PassportFieldSourceAttribution } from '@/app/dashboard/v2/mock/types';
import { SOURCE_KIND_LABELS } from '@/app/dashboard/v2/mock/passportFieldSource';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from 'cn';

type PassportSourceDocumentDialogProps = {
  readonly source: PassportFieldSourceAttribution | null;
  readonly fieldLabel: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
};

function DocumentPreview({ source }: { readonly source: PassportFieldSourceAttribution }) {
  const kind = SOURCE_KIND_LABELS[source.kind];
  const isJsonLike = source.kind === 'sap_s4' || source.kind === 'api';

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {kind} · {source.locationLabel}
      </p>
      <div
        className={cn(
          'mt-3 overflow-x-auto rounded-md border border-slate-200/80 bg-white p-4 text-[13px] leading-relaxed text-slate-800 shadow-inner',
          isJsonLike ? 'font-mono text-xs' : 'font-sans',
        )}
      >
        {source.excerptBefore ? (
          <span className="text-slate-400">{source.excerptBefore}</span>
        ) : null}
        <mark className="rounded bg-amber-200/90 px-0.5 text-slate-900 not-italic">
          {source.contextSnippet}
        </mark>
        {source.excerptAfter ? (
          <span className="text-slate-400">{source.excerptAfter}</span>
        ) : null}
      </div>
      {source.kind === 'image' ? (
        <p className="mt-2 text-xs text-slate-500">
          Bildquelle: OCR/Visions-Pipeline markiert die relevante Region im Werksfoto (Demo).
        </p>
      ) : null}
    </div>
  );
}

export function PassportSourceDocumentDialog({
  source,
  fieldLabel,
  open,
  onOpenChange,
}: PassportSourceDocumentDialogProps) {
  if (!source) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-base">Quelldokument</DialogTitle>
          <p className="text-sm text-slate-600">
            Feld: <span className="font-medium text-slate-900">{fieldLabel}</span>
          </p>
          <p className="text-xs text-slate-500">{source.documentTitle}</p>
        </DialogHeader>
        <DocumentPreview source={source} />
        <p className="text-[11px] text-slate-500">
          Dokument-ID: <code className="rounded bg-slate-100 px-1">{source.documentId}</code>
          {source.pageNumber ? ` · Seite ${source.pageNumber}` : null}
        </p>
      </DialogContent>
    </Dialog>
  );
}
