'use client';

import { useMemo, useState } from 'react';
import { ChevronRight, File, Folder } from 'lucide-react';
import { useSession } from '@/app/dashboard/v2/context/SessionProvider';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from 'cn';
import {
  buildIngestDocumentVault,
  type IngestDocumentFile,
  type IngestDocumentFolder,
} from './documentsIngestMock';

const STATUS_LABEL: Record<IngestDocumentFile['status'], string> = {
  indexed: 'Indexiert',
  extracted: 'Extrahiert',
  linked: 'Verknüpft',
};

function formatIngestDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('de-DE', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function FileRow({ file }: { readonly file: IngestDocumentFile }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 py-3 pl-10 pr-4 first:border-t-0">
      <File className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{file.name}</p>
        <p className="text-xs text-slate-500">
          {file.sizeLabel}
          {file.fieldsLinked != null ? ` · ${file.fieldsLinked.toLocaleString('de-DE')} Felder` : ''}
          {' · '}
          {formatIngestDate(file.ingestedAt)}
        </p>
      </div>
      <Badge variant="secondary" className="shrink-0 uppercase text-[10px]">
        {file.kind}
      </Badge>
      <Badge
        variant="outline"
        className={cn(
          'shrink-0 text-[10px]',
          file.status === 'extracted' && 'border-emerald-200 bg-emerald-50 text-emerald-800',
          file.status === 'linked' && 'border-sky-200 bg-sky-50 text-sky-800',
        )}
      >
        {STATUS_LABEL[file.status]}
      </Badge>
    </div>
  );
}

function FolderBlock({
  folder,
  open,
  onOpenChange,
}: {
  readonly folder: IngestDocumentFolder;
  readonly open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="border-b border-slate-100 last:border-b-0">
      <CollapsibleTrigger
        className="flex w-full cursor-pointer items-start gap-3 px-4 py-4 text-left hover:bg-slate-50/80"
      >
        <ChevronRight
          className={cn('mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform', open && 'rotate-90')}
          aria-hidden
        />
        <Folder className="h-5 w-5 shrink-0 text-amber-500" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900">{folder.name}</p>
          <p className="mt-0.5 text-xs text-slate-500">{folder.description}</p>
        </div>
        <span className="shrink-0 text-xs tabular-nums text-slate-500">{folder.files.length} Dateien</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="bg-slate-50/50 pb-2">
        {folder.files.map((file) => (
          <FileRow key={file.id} file={file} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function DocumentsIngestVault() {
  const { session } = useSession();
  const domain = session?.companyDomain ?? 'firma.de';
  const folders = useMemo(() => buildIngestDocumentVault(domain), [domain]);
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set(['compliance-inbox', 'product-ebike']));

  function setFolderOpen(id: string, open: boolean) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (open) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  const totalFiles = folders.reduce((n, f) => n + f.files.length, 0);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        <span className="font-semibold text-slate-800">{folders.length} Ordner</span>
        {' · '}
        <span className="tabular-nums">{totalFiles} Dateien</span>
        {' aus Global Ingest, PIM/ERP und Produktpass-Wizard (Demo).'}
      </p>
      <Card className="border-slate-200/90 shadow-sm">
        <CardContent className="p-0">
          {folders.map((folder) => (
            <FolderBlock
              key={folder.id}
              folder={folder}
              open={openIds.has(folder.id)}
              onOpenChange={(isOpen) => setFolderOpen(folder.id, isOpen)}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
