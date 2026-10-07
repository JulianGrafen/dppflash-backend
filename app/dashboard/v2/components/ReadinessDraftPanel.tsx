'use client';

import { useEffect, useState } from 'react';
import { filterVisibleDrafts } from '@/app/dashboard/v2/lib/discardableStubDraft';
import { computePassportCompleteness } from '@/app/dashboard/v2/mock/passportCompleteness';
import { ensurePassportFieldsOnDraft } from '@/app/dashboard/v2/mock/passportFields';
import { loadAllDrafts } from '@/app/dashboard/v2/mock/storage';
import type { DraftPassport } from '@/app/dashboard/v2/mock/types';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export function ReadinessDraftPanel() {
  const [drafts, setDrafts] = useState<DraftPassport[]>([]);

  useEffect(() => {
    setDrafts(filterVisibleDrafts(loadAllDrafts()));
  }, []);

  return (
    <div className="space-y-4">
      {drafts.length === 0 ? (
        <Card className="border-border shadow-sm">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Noch keine Daten zur Auswertung.
          </CardContent>
        </Card>
      ) : (
        drafts.map((draft) => {
          const s = computePassportCompleteness(ensurePassportFieldsOnDraft(draft));
          return (
            <Card key={draft.id} className="border-border shadow-sm">
              <CardContent className="space-y-3 py-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-foreground">{draft.productName}</p>
                  <span className="text-sm font-medium text-primary">{s.completenessPercent} %</span>
                </div>
                <Progress value={s.completenessPercent} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {s.missingCount} Pflichtfelder fehlen · {s.needsReviewCount} zu prüfen · Freigabe{' '}
                  {s.criticalOk ? 'möglich' : 'blockiert'}
                </p>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
