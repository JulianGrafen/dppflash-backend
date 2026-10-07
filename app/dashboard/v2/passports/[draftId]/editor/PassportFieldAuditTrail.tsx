'use client';

import { useState } from 'react';
import { ChevronDown, FileSearch, ExternalLink } from 'lucide-react';
import type { PassportFieldSourceAttribution } from '@/app/dashboard/v2/mock/types';
import { SOURCE_KIND_LABELS } from '@/app/dashboard/v2/mock/passportFieldSource';
import { Button } from '@/components/ui/button';
import { PassportSourceDocumentDialog } from './PassportSourceDocumentDialog';
import type { EditorContentLocale } from './EditorContentLocaleContext';
import { cn } from 'cn';

type PassportFieldAuditTrailProps = {
  readonly fieldLabel: string;
  readonly source: PassportFieldSourceAttribution;
  readonly confidence: number;
  readonly contentLocale: EditorContentLocale;
};

export function PassportFieldAuditTrail({
  fieldLabel,
  source,
  confidence,
  contentLocale,
}: PassportFieldAuditTrailProps) {
  const [expanded, setExpanded] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const isDe = contentLocale === 'de';

  return (
    <div className="mt-2">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-8 w-full cursor-pointer justify-between gap-2 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
        aria-expanded={expanded}
        onClick={() => setExpanded((open) => !open)}
      >
        <span className="inline-flex items-center gap-1.5">
          <FileSearch className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {expanded
            ? isDe
              ? 'Audit-Trail ausblenden'
              : 'Hide audit trail'
            : isDe
              ? 'Audit-Trail anzeigen'
              : 'Show audit trail'}
        </span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 transition-transform', expanded && 'rotate-180')}
          aria-hidden
        />
      </Button>

      {expanded ? (
        <section
          className="mt-2 rounded-lg border border-sky-100 bg-sky-50/40 p-3"
          aria-label={isDe ? 'Audit-Trail' : 'Audit trail'}
        >
          <div className="flex items-start gap-2">
            <FileSearch className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-900/80">
                  {isDe ? 'Herkunft (KI)' : 'Source (AI)'}
                </p>
                <span
                  className="shrink-0 text-[11px] font-bold tabular-nums text-sky-800"
                  title={isDe ? 'KI-Confidence' : 'AI confidence'}
                >
                  {Math.round(confidence * 100)}&nbsp;%
                </span>
              </div>
              <p className="mt-1 text-xs font-medium text-slate-900">
                {SOURCE_KIND_LABELS[source.kind]} · {source.documentTitle}
              </p>
              <p className="mt-0.5 text-xs text-slate-600">{source.locationLabel}</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-700">
                <mark className="rounded bg-amber-100 px-0.5">{source.contextSnippet}</mark>
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-3 w-full cursor-pointer gap-2 border-sky-200 bg-white text-sky-900 hover:bg-sky-50"
            onClick={() => setViewerOpen(true)}
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            {isDe ? 'Dokument öffnen & Stelle markieren' : 'Open document & highlight'}
          </Button>
        </section>
      ) : null}

      <PassportSourceDocumentDialog
        source={source}
        fieldLabel={fieldLabel}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
      />
    </div>
  );
}
