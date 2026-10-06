'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from '@/app/dashboard/v2/context/SessionProvider';
import { LinkButton } from '@/app/dashboard/v2/components/LinkButton';
import { V2StatCard } from '@/app/dashboard/v2/components/V2StatCard';
import { computeHubStats } from '@/app/dashboard/v2/lib/hubStats';
import { loadAllDrafts } from '@/app/dashboard/v2/mock/storage';
import type { DraftPassport } from '@/app/dashboard/v2/mock/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function DashboardV2HubPage() {
  const { session } = useSession();
  const [drafts, setDrafts] = useState<DraftPassport[]>([]);

  useEffect(() => {
    setDrafts(loadAllDrafts());
  }, []);

  const firstName = session?.email.split('@')[0] ?? 'Nutzer';
  const stats = useMemo(() => computeHubStats(drafts), [drafts]);
  const integrationOpen = session && !session.onboarding.completedAt;

  const activeDrafts = drafts.filter((d) => d.status !== 'published');
  const subtitle =
    activeDrafts.length > 0
      ? `${stats.openGaps} Angaben fehlen noch — Kennzahlen und offene Schritte für Ihre Produktpässe.`
      : 'Starten Sie mit einem neuen Digitalen Produktpass — Schwerpunkt Dokument-Upload mit KI-Extraktion (Mock).';

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-[#0c1929]">Hallo {firstName}!</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">{subtitle}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <V2StatCard label="Aktive Produktpässe" value={stats.activePasses} />
        <V2StatCard label="Offene Lücken" value={stats.openGaps} />
        <V2StatCard label="Zu prüfen (KI)" value={stats.openReviews} />
        <V2StatCard label="Offene Aufgaben" value={stats.openTasks} />
      </div>

      {integrationOpen ? (
        <Card className="border-amber-200 bg-amber-50/50 shadow-sm">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <p className="text-sm text-amber-950">
              Integrationen unvollständig — SAP, PIM und Datenimport im Onboarding abschließen.
            </p>
            <LinkButton href="/dashboard/v2/onboarding" variant="outline" className="cursor-pointer">
              Onboarding öffnen
            </LinkButton>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-sky-200 bg-gradient-to-br from-sky-50/80 to-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Schnellstart</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <LinkButton href="/dashboard/v2/passports/new" className="cursor-pointer">
            Neuen Produktpass erstellen
          </LinkButton>
          <LinkButton href="/dashboard/v2/produktpaesse" variant="outline" className="cursor-pointer">
            Zu den Produktpässen
          </LinkButton>
        </CardContent>
      </Card>
    </div>
  );
}
