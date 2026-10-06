'use client';

import { useEffect, useState } from 'react';
import { V2SectionShell } from '@/app/dashboard/v2/components/V2SectionShell';
import { computePassportCompleteness } from '@/app/dashboard/v2/mock/passportCompleteness';
import { ensurePassportFieldsOnDraft } from '@/app/dashboard/v2/mock/passportFields';
import { loadAllDrafts } from '@/app/dashboard/v2/mock/storage';
import type { DraftPassport } from '@/app/dashboard/v2/mock/types';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export default function ReadinessPage() {
  const [drafts, setDrafts] = useState<DraftPassport[]>([]);

  useEffect(() => {
    setDrafts(loadAllDrafts());
  }, []);

  return (
    <V2SectionShell
      title="Readiness"
      description="Vollständigkeit und Veröffentlichungsreife je Produktpass."
    >
      <div className="space-y-4">
        {drafts.length === 0 ? (
          <Card className="border-slate-200/90 shadow-sm">
            <CardContent className="py-10 text-center text-sm text-slate-500">
              Noch keine Daten zur Auswertung.
            </CardContent>
          </Card>
        ) : (
          drafts.map((draft) => {
            const s = computePassportCompleteness(ensurePassportFieldsOnDraft(draft));
            return (
              <Card key={draft.id} className="border-slate-200/90 shadow-sm">
                <CardContent className="space-y-3 py-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">{draft.productName}</p>
                    <span className="text-sm font-medium text-primary">{s.completenessPercent} %</span>
                  </div>
                  <Progress value={s.completenessPercent} className="h-2" />
                  <p className="text-xs text-slate-500">
                    {s.missingCount} Pflichtfelder fehlen · {s.needsReviewCount} zu prüfen · Publish{' '}
                    {s.criticalOk ? 'möglich' : 'blockiert'}
                  </p>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </V2SectionShell>
  );
}
