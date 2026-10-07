'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  PASSPORT_FIELD_DEFINITIONS,
  PASSPORT_SECTIONS,
  getSectionIdForFieldKey,
} from '@/app/domain/battery/passportFieldCatalog';
import { useDraft } from '@/app/dashboard/v2/context/DraftProvider';
import { passportFieldNeedsReview } from '@/app/dashboard/v2/mock/passportFields';
import { passportFieldLabel, passportFieldNote } from '@/app/domain/battery/passportFieldI18n';
import { useEditorContentLocale } from './EditorContentLocaleContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ReadinessBlockerFieldCard } from './ReadinessBlockerFieldCard';

export function PassportReadinessRail() {
  const { draft, passportSummary } = useDraft();
  const { locale } = useEditorContentLocale();
  const params = useParams<{ draftId: string }>();

  const defByKey = new Map(PASSPORT_FIELD_DEFINITIONS.map((d) => [d.key, d]));
  const sectionTitleById = new Map(PASSPORT_SECTIONS.map((s) => [s.id, s.title]));

  const aiLowConfidenceFields = PASSPORT_FIELD_DEFINITIONS.flatMap((def) => {
    const state = draft?.passportFields?.[def.key];
    if (!state || !passportFieldNeedsReview(state)) {
      return [];
    }
    return [{ def, state }];
  }).sort((a, b) => a.state.confidence - b.state.confidence);

  const remainingFields = 110 - Math.round((passportSummary.completenessPercent / 100) * 110);
  const readinessPercent = passportSummary.completenessPercent;
  const ringRadius = 26;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - readinessPercent / 100);

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <Card className="shrink-0 border-slate-200/90 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-[#0c1929]">
            {locale === 'de' ? 'Completion Rail' : 'Completion rail'}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
        <div className="flex items-center gap-4">
          <div
            className="relative flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center"
            role="img"
            aria-label={`Readiness ${readinessPercent} Prozent`}
          >
            <svg
              className="absolute inset-0 h-[4.5rem] w-[4.5rem] -rotate-90"
              viewBox="0 0 64 64"
              aria-hidden
            >
              <circle
                cx="32"
                cy="32"
                r={ringRadius}
                fill="none"
                stroke="currentColor"
                strokeWidth="5"
                className="text-slate-100"
              />
              <circle
                cx="32"
                cy="32"
                r={ringRadius}
                fill="none"
                stroke="currentColor"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringOffset}
                className="text-primary transition-[stroke-dashoffset] duration-300"
              />
            </svg>
            <span className="relative text-lg font-bold tabular-nums text-[#0c1929]">
              {readinessPercent}%
            </span>
          </div>
          <p className="text-xs font-medium text-slate-600">
            {locale === 'de' ? 'Bereitschaft' : 'Readiness'}
          </p>
        </div>
        <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 text-left">
          <p className="text-[10px] font-semibold uppercase text-slate-500">
            {locale === 'de' ? 'Offene Felder' : 'Fields open'}
          </p>
          <p className="text-xl font-bold tabular-nums text-slate-800">{remainingFields}</p>
        </div>

        <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 text-left">
          <p className="text-[10px] font-semibold uppercase text-slate-500">AI · niedrige Confidence</p>
          <p className="text-xl font-bold tabular-nums text-slate-800">{passportSummary.needsReviewCount}</p>
          {aiLowConfidenceFields.length > 0 ? (
            <ScrollArea className="mt-2 max-h-44">
            <ul className="space-y-1.5 pr-2 text-left">
              {aiLowConfidenceFields.map(({ def, state }) => {
                const targetSection = getSectionIdForFieldKey(def.key);
                return (
                  <li key={def.key}>
                    <Link
                      href={`/dashboard/v2/passports/${params.draftId}/editor?section=${targetSection}#field-${def.key}`}
                      className="flex items-start justify-between gap-2 rounded-md px-1 py-0.5 text-[11px] font-medium text-slate-800 hover:bg-slate-100/80"
                    >
                      <span className="min-w-0 leading-snug">{passportFieldLabel(def, locale)}</span>
                      <span className="shrink-0 tabular-nums text-slate-600">
                        {Math.round(state.confidence * 100)}%
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            </ScrollArea>
          ) : null}
        </div>
        </CardContent>
      </Card>

      {passportSummary.blockers.length > 0 ? (
        <div className="space-y-3">
          <div className="flex shrink-0 items-baseline justify-between gap-2 px-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {locale === 'de' ? 'Blocker · Pflichtfeld' : 'Blockers · mandatory'}
            </p>
            <p className="text-xl font-bold tabular-nums text-red-700">{passportSummary.missingCount}</p>
          </div>
          <ul className="space-y-3 pb-2">
            {passportSummary.blockers.map((b) => {
              const targetSection = getSectionIdForFieldKey(b.key);
              const def = defByKey.get(b.key);
              const sectionTitle = sectionTitleById.get(targetSection) ?? 'Publish blocker';
              const description = def
                ? passportFieldNote(def, locale)
                : locale === 'de'
                  ? 'Pflichtangabe fehlt — Publish nicht möglich.'
                  : 'A mandatory value is required before this passport can be published.';
              return (
                <li key={b.key}>
                  <ReadinessBlockerFieldCard
                    href={`/dashboard/v2/passports/${params.draftId}/editor?section=${targetSection}#field-${b.key}`}
                    title={def ? passportFieldLabel(def, locale) : b.label}
                    categoryLabel={sectionTitle}
                    description={description}
                    statusLabel={locale === 'de' ? 'Blockiert' : 'Blocked'}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
