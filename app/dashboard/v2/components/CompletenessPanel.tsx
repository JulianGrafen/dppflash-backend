'use client';

import Link from 'next/link';
import { CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react';
import type { CompletenessSummary, DraftField } from '@/app/dashboard/v2/mock/types';
import { canPublish, fieldNeedsReview } from '@/app/dashboard/v2/mock/completeness';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

type CompletenessPanelProps = {
  readonly draftId: string;
  readonly summary: CompletenessSummary;
  readonly fields: readonly DraftField[];
  readonly step?: string;
};

export function CompletenessPanel({ draftId, summary, fields, step }: CompletenessPanelProps) {
  const openFields = fields.filter(
    (f) => f.provenance === 'missing' || fieldNeedsReview(f),
  );

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">DPP-Vollständigkeit</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-[#0c1929]">{summary.completenessPercent} %</span>
            {step ? <Badge variant="secondary">{step}</Badge> : null}
          </div>
          <Progress value={summary.completenessPercent} className="h-2" />
        </div>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2 text-slate-700">
            <AlertCircle className="h-4 w-4 text-amber-600" aria-hidden />
            <span>
              <strong>{summary.missingCount}</strong> Angaben fehlen
            </span>
          </li>
          <li className="flex items-center gap-2 text-slate-700">
            <HelpCircle className="h-4 w-4 text-sky-600" aria-hidden />
            <span>
              <strong>{summary.needsReviewCount}</strong> Angaben müssen überprüft werden
            </span>
          </li>
          <li className="flex items-center gap-2 text-slate-700">
            <CheckCircle2
              className={`h-4 w-4 ${summary.criticalOk ? 'text-emerald-600' : 'text-slate-300'}`}
              aria-hidden
            />
            <span>
              {summary.criticalOk
                ? 'Alle kritischen Angaben vorhanden'
                : 'Kritische Angaben unvollständig'}
            </span>
          </li>
        </ul>
        {openFields.length > 0 ? (
          <div className="border-t border-slate-100 pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Offene Punkte
            </p>
            <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
              {openFields.map((f) => (
                <li key={f.path}>
                  <Link
                    href={`/dashboard/v2/passports/new/${draftId}/review-data#field-${f.path}`}
                    className="text-sky-700 hover:underline"
                  >
                    {f.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {canPublish(summary) ? (
          <p className="text-xs text-emerald-700">Bereit zur Prüfung / Veröffentlichung</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
