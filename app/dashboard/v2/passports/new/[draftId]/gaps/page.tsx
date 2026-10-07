'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useDraft } from '@/app/dashboard/v2/context/DraftProvider';
import { SupplierOutreachDialog } from '@/app/dashboard/v2/components/SupplierOutreachDialog';
import { WizardLayout } from '../WizardLayout';
import { legacyFieldToSupplierView } from '@/app/dashboard/v2/lib/supplierRequestView';
import type { DraftField } from '@/app/dashboard/v2/mock/types';
import { LinkButton } from '@/app/dashboard/v2/components/LinkButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function GapsStepPage() {
  const { draft, markSupplierPending, replace } = useDraft();
  const params = useParams<{ draftId: string }>();
  const [outreachField, setOutreachField] = useState<DraftField | null>(null);
  const outreachView = outreachField ? legacyFieldToSupplierView(outreachField) : null;

  if (!draft) {
    return null;
  }

  const missing = draft.fields.filter((f) => f.provenance === 'missing');

  return (
    <WizardLayout>
      <Card>
        <CardHeader>
          <CardTitle>Fehlende Daten</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {missing.length === 0 ? (
            <p className="text-sm text-emerald-700">Keine fehlenden Pflichtangaben mehr.</p>
          ) : (
            missing.map((field) => (
              <div
                key={field.path}
                className="rounded-xl border border-slate-200 bg-slate-50/50 p-4"
              >
                <p className="text-sm font-medium text-slate-900">
                  Für dieses Produkt fehlen Informationen: <strong>{field.label}</strong>
                </p>
                {field.supplierHint ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Vorgeschlagener Lieferant: {field.supplierHint}
                  </p>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  className="mt-3 cursor-pointer"
                  onClick={() => setOutreachField(field)}
                >
                  Lieferanten anfragen
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <SupplierOutreachDialog
        open={outreachField !== null}
        draftId={params.draftId}
        field={outreachView}
        onClose={() => setOutreachField(null)}
        onSend={() => {
          if (outreachField) {
            markSupplierPending(outreachField.path);
          }
          setOutreachField(null);
        }}
      />

      <div className="mt-4 flex flex-wrap gap-2">
        <LinkButton
          href={`/dashboard/v2/passports/new/${params.draftId}/review-data`}
          variant="outline"
          className="cursor-pointer"
        >
          Zurück
        </LinkButton>
        <LinkButton
          href={`/dashboard/v2/passports/new/${params.draftId}/check`}
          className="cursor-pointer"
          onClick={() =>
            replace({
              ...draft,
              visitedSteps: [...new Set([...draft.visitedSteps, 'check'])],
            })
          }
        >
          Zur Prüfung
        </LinkButton>
      </div>
    </WizardLayout>
  );
}
