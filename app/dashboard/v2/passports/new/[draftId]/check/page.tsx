'use client';

import { useParams } from 'next/navigation';
import { LinkButton } from '@/app/dashboard/v2/components/LinkButton';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useDraft } from '@/app/dashboard/v2/context/DraftProvider';
import { WizardLayout } from '../WizardLayout';
import { canPublish } from '@/app/dashboard/v2/mock/completeness';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const CHECKS = [
  { id: 'required', label: 'Alle erforderlichen Daten vorhanden' },
  { id: 'mandatory', label: 'Pflichtfelder ausgefüllt' },
  { id: 'conflict', label: 'Keine widersprüchlichen Angaben (Demo)' },
  { id: 'evidence', label: 'Nachweise / Dokumente verknüpft' },
  { id: 'plausible', label: 'Daten plausibel (Demo)' },
  { id: 'publish', label: 'DPP bereit zur Veröffentlichung' },
];

export default function CheckStepPage() {
  const { draft, summary, replace } = useDraft();
  const params = useParams<{ draftId: string }>();
  const ready = canPublish(summary);

  if (!draft) {
    return null;
  }

  return (
    <WizardLayout>
      <Card>
        <CardHeader>
          <CardTitle>Prüfung des Produktpasses</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-slate-600">
            {ready
              ? 'Ihr Produktpass wurde geprüft und kann veröffentlicht werden.'
              : 'Bitte schließen Sie noch offene Lücken ab, bevor Sie veröffentlichen.'}
          </p>
          <ul className="space-y-2">
            {CHECKS.map((check, index) => {
              const pass =
                index < 4
                  ? summary.missingCount === 0 || index < 2
                  : ready;
              return (
                <li key={check.id} className="flex items-center gap-2 text-sm">
                  {pass ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
                  ) : (
                    <XCircle className="h-4 w-4 text-amber-600" aria-hidden />
                  )}
                  {check.label}
                </li>
              );
            })}
          </ul>
          {summary.needsReviewCount > 0 ? (
            <p className="mt-4 text-xs text-amber-800">
              Hinweis: {summary.needsReviewCount} Felder sind noch nicht bestätigt — Veröffentlichung trotzdem
              möglich, wenn keine Lücken mehr bestehen.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="mt-4 flex flex-wrap gap-2">
        <LinkButton
          href={`/dashboard/v2/passports/new/${params.draftId}/gaps`}
          variant="outline"
          className="cursor-pointer"
        >
          Zurück
        </LinkButton>
        {ready ? (
          <LinkButton
            href={`/dashboard/v2/passports/new/${params.draftId}/publish`}
            className="cursor-pointer"
            onClick={() =>
              replace({
                ...draft,
                visitedSteps: [...new Set([...draft.visitedSteps, 'publish'])],
              })
            }
          >
            Zur Veröffentlichung
          </LinkButton>
        ) : (
          <Button type="button" disabled className="cursor-not-allowed">
            Zur Veröffentlichung
          </Button>
        )}
      </div>
    </WizardLayout>
  );
}
