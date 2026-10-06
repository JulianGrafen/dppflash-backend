'use client';

import { useParams } from 'next/navigation';
import { useDraft } from '@/app/dashboard/v2/context/DraftProvider';
import { FieldGroupsAccordion } from '@/app/dashboard/v2/components/FieldGroupsAccordion';
import { LinkButton } from '@/app/dashboard/v2/components/LinkButton';
import { WizardLayout } from '../WizardLayout';
import { fieldNeedsReview } from '@/app/dashboard/v2/mock/completeness';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ReviewDataStepPage() {
  const { draft, summary, confirmField, updateField, replace } = useDraft();
  const params = useParams<{ draftId: string }>();

  if (!draft) {
    return null;
  }

  const reviewFields = draft.fields.filter((f) => fieldNeedsReview(f));

  function markVisited(step: string) {
    if (!draft) {
      return;
    }
    replace({
      ...draft,
      visitedSteps: [...new Set([...draft.visitedSteps, step])],
    });
  }

  return (
    <WizardLayout>
      <div className="space-y-4">
        {summary.needsReviewCount > 0 ? (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Human in the loop</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-amber-950">
              <strong>{reviewFields.length}</strong> Felder mit niedriger KI-Confidence — bitte prüfen und
              bestätigen.
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Erkannte Produktdaten</CardTitle>
          </CardHeader>
          <CardContent>
            {draft.fields.length === 0 ? (
              <p className="text-sm text-slate-500">Noch keine Daten — bitte zuerst Dokumente hochladen.</p>
            ) : (
              <FieldGroupsAccordion
                fields={draft.fields}
                onConfirm={confirmField}
                onChange={(path, value) => updateField(path, { value, provenance: 'ai' })}
              />
            )}
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <LinkButton
            href={`/dashboard/v2/passports/new/${params.draftId}/upload`}
            variant="outline"
            className="cursor-pointer"
          >
            Zurück
          </LinkButton>
          <LinkButton
            href={`/dashboard/v2/passports/new/${params.draftId}/gaps`}
            className="cursor-pointer"
            onClick={() => markVisited('gaps')}
          >
            Weiter zu Lücken
          </LinkButton>
        </div>
      </div>
    </WizardLayout>
  );
}
