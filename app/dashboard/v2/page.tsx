'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from '@/app/dashboard/v2/context/SessionProvider';
import { LinkButton } from '@/app/dashboard/v2/components/LinkButton';
import { V2StatCard } from '@/app/dashboard/v2/components/V2StatCard';
import { computeHubStats, formatDraftDate } from '@/app/dashboard/v2/lib/hubStats';
import { draftApprovalHref, listDraftsPendingApproval } from '@/app/dashboard/v2/lib/pendingApproval';
import { computePassportCompleteness } from '@/app/dashboard/v2/mock/passportCompleteness';
import { ensurePassportFieldsOnDraft } from '@/app/dashboard/v2/mock/passportFields';
import { filterVisibleDrafts } from '@/app/dashboard/v2/lib/discardableStubDraft';
import { loadAllDrafts } from '@/app/dashboard/v2/mock/storage';
import type { DraftPassport } from '@/app/dashboard/v2/mock/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EnterMotion, enterMotionDelay } from '@/components/ui/enter-motion';

export default function DashboardV2HubPage() {
  const { session } = useSession();
  const [drafts, setDrafts] = useState<DraftPassport[]>([]);

  useEffect(() => {
    setDrafts(filterVisibleDrafts(loadAllDrafts()));
  }, []);

  const firstName = session?.email.split('@')[0] ?? 'Nutzer';
  const stats = useMemo(() => computeHubStats(drafts), [drafts]);
  const integrationOpen = session && !session.onboarding.completedAt;

  const activeDrafts = drafts.filter((d) => d.status !== 'published');
  const pendingApproval = useMemo(() => listDraftsPendingApproval(drafts), [drafts]);
  const subtitle =
    activeDrafts.length > 0
      ? `${stats.openGaps} Angaben fehlen noch — Kennzahlen und offene Schritte für Ihre Produktpässe.`
      : 'Starten Sie mit einem neuen Digitalen Produktpass — Schwerpunkt Dokument-Upload mit KI-Extraktion (Mock).';

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <EnterMotion>
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Hallo {firstName}!</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">{subtitle}</p>
        </header>
      </EnterMotion>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <V2StatCard label="Aktive Produktpässe" value={stats.activePasses} delayMs={enterMotionDelay(0)} />
        <V2StatCard label="Offene Lücken" value={stats.openGaps} delayMs={enterMotionDelay(1)} />
        <V2StatCard label="Zu prüfen (KI)" value={stats.openReviews} delayMs={enterMotionDelay(2)} />
      </div>

      {integrationOpen ? (
        <EnterMotion delayMs={enterMotionDelay(3)}>
        <Card variant="elevated" className="border-amber-200 bg-amber-50/50">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <p className="text-sm text-amber-950">
              Integrationen unvollständig — SAP, PIM und Datenimport im Onboarding abschließen.
            </p>
            <LinkButton href="/dashboard/v2/onboarding" variant="outline" className="cursor-pointer">
              Onboarding öffnen
            </LinkButton>
          </CardContent>
        </Card>
        </EnterMotion>
      ) : null}

      <EnterMotion delayMs={enterMotionDelay(4)}>
      <Card
        variant="elevated"
        className="border-sky-200 bg-gradient-to-br from-sky-50/80 to-card"
      >
        <CardHeader>
          <CardTitle className="text-lg">Schnellstart</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {pendingApproval.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-800">Warten auf Freigabe</p>
              <ul className="divide-y divide-sky-100 overflow-hidden rounded-lg border border-sky-100 bg-white/90">
                {pendingApproval.map((draft) => {
                  const summary = computePassportCompleteness(ensurePassportFieldsOnDraft(draft));
                  return (
                    <li
                      key={draft.id}
                      className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-900">{draft.productName}</p>
                          <Badge variant="secondary" className="bg-amber-50 text-amber-900 hover:bg-amber-50">
                            Freigabe ausstehend
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-600">
                          {summary.completenessPercent} % vollständig · Aktualisiert{' '}
                          {formatDraftDate(draft.updatedAt)}
                        </p>
                      </div>
                      <LinkButton
                        href={draftApprovalHref(draft)}
                        size="sm"
                        variant="outline"
                        className="shrink-0 cursor-pointer sm:min-w-[9.5rem]"
                      >
                        Freigabe prüfen
                      </LinkButton>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-slate-600">Aktuell keine Produktpässe in der Freigabe-Warteschlange.</p>
          )}
          <div className="flex flex-wrap gap-3 border-t border-sky-100/80 pt-4">
            <LinkButton href="/dashboard/v2/passports/new" className="cursor-pointer">
              Neuen Produktpass erstellen
            </LinkButton>
            <LinkButton href="/dashboard/v2/produktpaesse" variant="outline" className="cursor-pointer">
              Zu den Produktpässen
            </LinkButton>
          </div>
        </CardContent>
      </Card>
      </EnterMotion>
    </div>
  );
}
