'use client';

import { useParams, useRouter } from 'next/navigation';
import QRCodeDisplay from '@/app/components/QRCodeDisplay';
import { useDraft } from '@/app/dashboard/v2/context/DraftProvider';
import { WizardLayout } from '../WizardLayout';
import { canPublish } from '@/app/dashboard/v2/mock/completeness';
import { LinkButton } from '@/app/dashboard/v2/components/LinkButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PublishStepPage() {
  const { draft, summary, publish } = useDraft();
  const params = useParams<{ draftId: string }>();
  const router = useRouter();
  const ready = canPublish(summary);
  const published = draft?.status === 'published';

  if (!draft) {
    return null;
  }

  return (
    <WizardLayout>
      <Card>
        <CardHeader>
          <CardTitle>Veröffentlichung</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Produkt</dt>
              <dd className="font-semibold">{draft.productName}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd className="font-semibold">{published ? 'Veröffentlicht' : 'Entwurf'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Vollständigkeit</dt>
              <dd className="font-semibold">{summary.completenessPercent} %</dd>
            </div>
            <div>
              <dt className="text-slate-500">Prüfung</dt>
              <dd className="font-semibold">{ready ? 'Bestanden' : 'Offen'}</dd>
            </div>
          </dl>

          {!published ? (
            <Button
              type="button"
              size="lg"
              disabled={!ready}
              className="cursor-pointer"
              onClick={() => {
                void publish().then(() => {
                  router.push(`/dashboard/v2/passports/${params.draftId}/editor`);
                });
              }}
            >
              Produktpass veröffentlichen
            </Button>
          ) : (
            <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
              <p className="text-sm font-medium text-emerald-900">
                Produktpass veröffentlicht — Link und QR-Code:
              </p>
              <p className="font-mono text-xs break-all text-slate-700">
                {draft.publishedUrl ?? '/p/battery-demo-public'}
              </p>
              <QRCodeDisplay
                productId={draft.publishedPassId ?? 'battery-demo-public'}
                productName={draft.productName}
              />
              <LinkButton
                href={`/p/${draft.publishedPassId ?? 'voltstride-720'}`}
                variant="outline"
                className="cursor-pointer"
              >
                Öffentlichen Pass öffnen
              </LinkButton>
              <LinkButton
                href={`/dashboard/v2/passports/${params.draftId}/editor`}
                className="cursor-pointer"
              >
                Im Editor bearbeiten
              </LinkButton>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-4">
        <LinkButton
          href={`/dashboard/v2/passports/new/${params.draftId}/check`}
          variant="outline"
          className="cursor-pointer"
        >
          Zurück
        </LinkButton>
      </div>
    </WizardLayout>
  );
}
