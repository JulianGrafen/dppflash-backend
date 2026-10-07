'use client';

import { useEffect, useState } from 'react';
import { LinkButton } from '@/app/dashboard/v2/components/LinkButton';
import { V2SectionShell } from '@/app/dashboard/v2/components/V2SectionShell';
import { draftResumeHref, formatDraftDate } from '@/app/dashboard/v2/lib/hubStats';
import { computePassportCompleteness } from '@/app/dashboard/v2/mock/passportCompleteness';
import { ensurePassportFieldsOnDraft } from '@/app/dashboard/v2/mock/passportFields';
import { filterVisibleDrafts } from '@/app/dashboard/v2/lib/discardableStubDraft';
import { loadAllDrafts } from '@/app/dashboard/v2/mock/storage';
import type { DraftPassport } from '@/app/dashboard/v2/mock/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress, ProgressIndicator, ProgressLabel, ProgressTrack } from '@/components/ui/progress';
import { cn } from 'cn';

function statusLabel(status: DraftPassport['status']): string {
  if (status === 'published') {
    return 'Veröffentlicht';
  }
  if (status === 'review') {
    return 'In Prüfung';
  }
  return 'Entwurf';
}

function creationMethodLabel(method: DraftPassport['creationMethod']): string {
  switch (method) {
    case 'upload':
      return 'Upload';
    case 'import':
      return 'Import';
    case 'manual':
      return 'Manuell';
    case 'existing':
      return 'Bestand';
    default:
      return method;
  }
}

export default function ProduktePage() {
  const [drafts, setDrafts] = useState<DraftPassport[]>(() =>
    typeof window !== 'undefined' ? filterVisibleDrafts(loadAllDrafts()) : [],
  );

  useEffect(() => {
    setDrafts(filterVisibleDrafts(loadAllDrafts()));
  }, []);

  return (
    <V2SectionShell
      title="Produkte"
      description="Stammdaten und Produktidentität aus Ihren Entwürfen (Mock)."
    >
      <Card variant="elevated" className="border-border">
        <CardContent className="divide-y divide-border p-0">
          {drafts.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              Noch keine Produkte erfasst.
            </p>
          ) : (
            drafts.map((draft) => {
              const summary = computePassportCompleteness(ensurePassportFieldsOnDraft(draft));
              const percent = summary.completenessPercent;

              return (
                <div
                  key={draft.id}
                  className="flex flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                      <span className="min-w-0 font-medium leading-5 text-foreground">
                        {draft.productName}
                      </span>
                      <span className="inline-flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary" className="h-5 shrink-0">
                          {statusLabel(draft.status)}
                        </Badge>
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Methode: {creationMethodLabel(draft.creationMethod)} · Aktualisiert{' '}
                      {formatDraftDate(draft.updatedAt)}
                    </p>
                    <Progress value={percent} className="max-w-md gap-1.5">
                      <div className="flex w-full items-center justify-between gap-2">
                        <ProgressLabel className="text-xs font-medium text-muted-foreground">
                          Vollständigkeit
                        </ProgressLabel>
                        <span className="text-xs font-semibold tabular-nums text-foreground">
                          {percent} %
                        </span>
                      </div>
                      <ProgressTrack className="h-2">
                        <ProgressIndicator
                          className={cn(
                            percent >= 100 && 'bg-emerald-600',
                            percent > 0 && percent < 100 && 'bg-primary',
                          )}
                        />
                      </ProgressTrack>
                    </Progress>
                  </div>
                  <LinkButton
                    href={draftResumeHref(draft)}
                    variant="outline"
                    size="sm"
                    className="shrink-0 cursor-pointer sm:min-w-[7.5rem]"
                  >
                    Details
                  </LinkButton>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </V2SectionShell>
  );
}
