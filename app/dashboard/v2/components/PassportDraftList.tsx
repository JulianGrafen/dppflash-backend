'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LinkButton } from '@/app/dashboard/v2/components/LinkButton';
import { draftResumeHref, formatDraftDate } from '@/app/dashboard/v2/lib/hubStats';
import { computePassportCompleteness } from '@/app/dashboard/v2/mock/passportCompleteness';
import { ensurePassportFieldsOnDraft } from '@/app/dashboard/v2/mock/passportFields';
import { DEMO_READY_100_DRAFT_ID } from '@/app/dashboard/v2/mock/demoReady100Passport';
import { loadAllDrafts } from '@/app/dashboard/v2/mock/storage';
import type { DraftPassport } from '@/app/dashboard/v2/mock/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function statusLabel(status: DraftPassport['status']): string {
  if (status === 'published') {
    return 'Veröffentlicht';
  }
  if (status === 'review') {
    return 'In Prüfung';
  }
  return 'Entwurf';
}

type PassportDraftListProps = {
  readonly showPublished?: boolean;
  readonly newPassCta?: boolean;
};

export function PassportDraftList({ showPublished = false, newPassCta = true }: PassportDraftListProps) {
  const [drafts, setDrafts] = useState<DraftPassport[]>([]);

  useEffect(() => {
    setDrafts(loadAllDrafts());
  }, []);

  const activeDrafts = drafts.filter((d) => d.status !== 'published');
  const published = drafts.filter((d) => d.status === 'published');

  return (
    <div className="space-y-6">
      <Card variant="elevated" className="border-border">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-lg">Produktpässe</CardTitle>
            {activeDrafts.length > 0 ? (
              <Badge className="bg-primary/15 text-primary hover:bg-primary/15">
                {activeDrafts.length} aktiv
              </Badge>
            ) : null}
          </div>
          {newPassCta ? (
            <LinkButton href="/dashboard/v2/passports/new" size="sm" className="cursor-pointer">
              Neuen Pass erstellen
            </LinkButton>
          ) : null}
        </CardHeader>
        <CardContent className="p-0">
          {activeDrafts.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              Noch keine Entwürfe.{' '}
              <Link href="/dashboard/v2/passports/new" className="font-medium text-primary underline">
                Jetzt starten
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {activeDrafts.map((draft) => {
                const summary = computePassportCompleteness(ensurePassportFieldsOnDraft(draft));
                const isNew =
                  Date.now() - new Date(draft.createdAt).getTime() < 48 * 60 * 60 * 1000;

                return (
                  <li
                    key={draft.id}
                    className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                        <span className="min-w-0 font-semibold leading-5 text-foreground">
                          {draft.productName}
                        </span>
                        <span className="inline-flex flex-wrap items-center gap-1.5">
                          {isNew ? (
                            <Badge
                              className="h-5 shrink-0 bg-primary/15 text-[11px] text-primary hover:bg-primary/15"
                            >
                              NEU
                            </Badge>
                          ) : null}
                          {draft.id === DEMO_READY_100_DRAFT_ID ? (
                            <Badge className="h-5 shrink-0 bg-sky-100 text-sky-900 hover:bg-sky-100">
                              Demo 100 %
                            </Badge>
                          ) : null}
                          <Badge variant="secondary" className="h-5 shrink-0">
                            {statusLabel(draft.status)}
                          </Badge>
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Vollständigkeit {summary.completenessPercent} % · Aktualisiert:{' '}
                        {formatDraftDate(draft.updatedAt)}
                      </p>
                    </div>
                    <LinkButton
                      href={draftResumeHref(draft)}
                      className="shrink-0 cursor-pointer sm:min-w-[10rem]"
                    >
                      Weiter bearbeiten
                    </LinkButton>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {showPublished && published.length > 0 ? (
        <Card className="border-slate-200/90 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Veröffentlicht</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-0 pt-0">
            <ul className="divide-y divide-border">
              {published.map((draft) => (
                <li key={draft.id}>
                  <Link
                    href="/p/battery-demo-public"
                    className="flex cursor-pointer items-center justify-between px-6 py-4 hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-900">{draft.productName}</span>
                    <Badge variant="secondary">Live</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
