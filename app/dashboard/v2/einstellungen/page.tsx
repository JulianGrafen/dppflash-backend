'use client';

import { useState } from 'react';
import Link from 'next/link';
import { V2SectionShell } from '@/app/dashboard/v2/components/V2SectionShell';
import { useSession } from '@/app/dashboard/v2/context/SessionProvider';
import { buildSapMockPatches } from '@/app/dashboard/v2/mock/ingest/sapMockPatches';
import { applyIngestToPassportFields } from '@/app/dashboard/v2/mock/ingest/applyIngestToPassportFields';
import { loadDraft, upsertDraft } from '@/app/dashboard/v2/mock/storage';
import { ensurePassportFieldsOnDraft } from '@/app/dashboard/v2/mock/passportFields';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function EinstellungenPage() {
  const { session, updateSession } = useSession();
  const [syncing, setSyncing] = useState(false);

  const onboarding = session?.onboarding;
  const integrations = session?.integrations;

  async function resyncSapDemo() {
    const draftId = integrations?.onboardingDraftId;
    if (!draftId) {
      return;
    }
    setSyncing(true);
    await new Promise((r) => setTimeout(r, 800));
    const draft = loadDraft(draftId);
    if (draft) {
      const fields = applyIngestToPassportFields(
        ensurePassportFieldsOnDraft(draft),
        buildSapMockPatches(integrations?.sapHost),
        { source: 'sap_mock', structured: true },
      );
      upsertDraft({ ...draft, passportFields: fields, updatedAt: new Date().toISOString() });
    }
    updateSession({ onboarding: { sapConnected: true } });
    setSyncing(false);
  }

  const webhookDisplay =
    typeof window !== 'undefined' && session?.tenantId
      ? `${window.location.origin}/api/inbound/ingest/webhook?tenant_id=${encodeURIComponent(session.tenantId)}`
      : `/api/inbound/ingest/webhook?tenant_id=${session?.tenantId ?? ''}`;

  return (
    <V2SectionShell
      title="Einstellungen"
      description="Organisation, Integrationen und Demo-Daten."
    >
      <div className="space-y-4">
        <Card className="border-slate-200/90 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Organisation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <p>
              <strong className="text-slate-900">Firma:</strong>{' '}
              {integrations?.companyName ?? '—'}
            </p>
            <p>
              <strong className="text-slate-900">Domain:</strong> {session?.companyDomain ?? '—'}
            </p>
            <p>
              <strong className="text-slate-900">Tenant:</strong>{' '}
              <code className="rounded bg-slate-100 px-1 text-xs">{session?.tenantId}</code>
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/90 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Integrationen (Demo)</CardTitle>
            {!onboarding?.completedAt ? (
              <Link href="/dashboard/v2/onboarding" className="text-xs font-medium text-primary underline">
                Onboarding fortsetzen
              </Link>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <span className="font-medium text-slate-800">SAP S/4HANA</span>
              <Badge variant={onboarding?.sapConnected ? 'secondary' : 'outline'}>
                {onboarding?.sapConnected ? 'Verbunden (Demo)' : 'Nicht verbunden'}
              </Badge>
            </div>
            <p className="text-slate-600">Host: {integrations?.sapHost ?? '—'}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer"
              disabled={syncing || !integrations?.onboardingDraftId}
              onClick={() => void resyncSapDemo()}
            >
              {syncing ? 'Sync…' : 'SAP Re-Sync (Demo)'}
            </Button>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <span className="font-medium text-slate-800">PIM Webhook</span>
              <Badge variant={onboarding?.pimConfigured ? 'secondary' : 'outline'}>
                {onboarding?.pimConfigured ? 'Konfiguriert' : 'Offen'}
              </Badge>
            </div>
            <p className="break-all font-mono text-xs text-slate-600">{webhookDisplay}</p>
            <p className="text-slate-600">
              Secret: <code className="rounded bg-slate-100 px-1">{integrations?.pimWebhookSecret ?? '—'}</code>
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/90 shadow-sm">
          <CardContent className="py-6 text-sm text-slate-600">
            Entwürfe liegen in <code className="rounded bg-slate-100 px-1">localStorage</code> — siehe{' '}
            <code className="rounded bg-slate-100 px-1">docs/DASHBOARD_V2_MOCK.md</code>.
          </CardContent>
        </Card>
      </div>
    </V2SectionShell>
  );
}
