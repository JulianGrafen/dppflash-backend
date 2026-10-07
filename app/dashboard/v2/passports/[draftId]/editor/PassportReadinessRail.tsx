'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
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
import { SupplierOutreachDialog } from '@/app/dashboard/v2/components/SupplierOutreachDialog';
import { suggestedSupplierForPassportField } from '@/app/dashboard/v2/lib/passportSupplierHints';
import { passportFieldToSupplierView } from '@/app/dashboard/v2/lib/supplierRequestView';
import { Button } from '@/components/ui/button';
import { cn } from 'cn';
import { ReadinessBlockerFieldCard } from './ReadinessBlockerFieldCard';

type PassportReadinessRailProps = {
  readonly layout?: 'page' | 'dock';
};

export function PassportReadinessRail({ layout = 'page' }: PassportReadinessRailProps) {
  const docked = layout === 'dock';
  const { draft, passportSummary, markPassportSupplierPending, markPassportSuppliersPending } =
    useDraft();
  const [outreachKey, setOutreachKey] = useState<string | null>(null);
  const [bulkOutreachOpen, setBulkOutreachOpen] = useState(false);
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

  const outreachDef = outreachKey ? defByKey.get(outreachKey) : undefined;
  const outreachState = outreachKey ? draft?.passportFields?.[outreachKey] : undefined;
  const outreachSuggestion = outreachKey ? suggestedSupplierForPassportField(outreachKey) : null;
  const outreachView =
    outreachKey && outreachDef && outreachState && outreachSuggestion
      ? passportFieldToSupplierView(outreachKey, passportFieldLabel(outreachDef, locale), {
          ...outreachState,
          supplierHint: outreachState.supplierHint ?? outreachSuggestion.supplierHint,
          supplierEmail: outreachState.supplierEmail ?? outreachSuggestion.supplierEmail,
        })
      : null;

  const bulkOutreachViews = passportSummary.blockers.flatMap((b) => {
    const def = defByKey.get(b.key);
    const state = draft?.passportFields?.[b.key];
    if (!def || !state) {
      return [];
    }
    const suggestion = suggestedSupplierForPassportField(b.key);
    return [
      passportFieldToSupplierView(b.key, passportFieldLabel(def, locale), {
        ...state,
        supplierHint: state.supplierHint ?? suggestion.supplierHint,
        supplierEmail: state.supplierEmail ?? suggestion.supplierEmail,
      }),
    ];
  });
  const blockerKeys = passportSummary.blockers.map((b) => b.key);
  const hasBlockers = passportSummary.blockers.length > 0;

  const blockerList = (
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
        const fieldState = draft?.passportFields?.[b.key];
        const pendingSupplier = fieldState?.provenance === 'pending_supplier';
        return (
          <li key={b.key}>
            <ReadinessBlockerFieldCard
              href={`/dashboard/v2/passports/${params.draftId}/editor?section=${targetSection}#field-${b.key}`}
              title={def ? passportFieldLabel(def, locale) : b.label}
              categoryLabel={sectionTitle}
              description={description}
              statusLabel={locale === 'de' ? 'Blockiert' : 'Blocked'}
              action={
                <Button
                  type="button"
                  size="sm"
                  variant={pendingSupplier ? 'outline' : 'default'}
                  className="w-full cursor-pointer"
                  onClick={() => setOutreachKey(b.key)}
                >
                  {pendingSupplier
                    ? locale === 'de'
                      ? 'Anfrage erneut senden'
                      : 'Resend request'
                    : locale === 'de'
                      ? 'Lieferantenanfrage stellen'
                      : 'Request from supplier'}
                </Button>
              }
            />
          </li>
        );
      })}
    </ul>
  );

  return (
    <div
      className={
        docked ? 'flex min-h-0 flex-1 flex-col gap-3' : 'flex min-h-0 flex-col gap-4'
      }
    >
      <Card
        variant="elevated"
        className={cn(
          'border-border',
          docked && hasBlockers
            ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
            : 'shrink-0',
        )}
      >
        <CardHeader className="shrink-0 pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">
            {locale === 'de' ? 'Completion Rail' : 'Completion rail'}
          </CardTitle>
        </CardHeader>
        <CardContent
          className={cn(
            'pt-0',
            docked && hasBlockers && 'flex min-h-0 flex-1 flex-col overflow-hidden',
          )}
        >
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
                className="text-muted"
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
            <span className="relative text-lg font-bold tabular-nums text-foreground">
              {readinessPercent}%
            </span>
          </div>
          <p className="text-xs font-medium text-muted-foreground">
            {locale === 'de' ? 'Bereitschaft' : 'Readiness'}
          </p>
        </div>
        <div className="mt-4 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-left">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">
            {locale === 'de' ? 'Offene Felder' : 'Fields open'}
          </p>
          <p className="text-xl font-bold tabular-nums text-foreground">{remainingFields}</p>
        </div>

        <div className="mt-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-left">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">AI · niedrige Confidence</p>
          <p className="text-xl font-bold tabular-nums text-foreground">{passportSummary.needsReviewCount}</p>
          {aiLowConfidenceFields.length > 0 ? (
            <ScrollArea className="mt-2 max-h-44">
            <ul className="space-y-1.5 pr-2 text-left">
              {aiLowConfidenceFields.map(({ def, state }) => {
                const targetSection = getSectionIdForFieldKey(def.key);
                return (
                  <li key={def.key}>
                    <Link
                      href={`/dashboard/v2/passports/${params.draftId}/editor?section=${targetSection}#field-${def.key}`}
                      scroll={false}
                      className="flex items-start justify-between gap-2 rounded-md px-1 py-0.5 text-[11px] font-medium text-foreground hover:bg-muted/60"
                    >
                      <span className="min-w-0 leading-snug">{passportFieldLabel(def, locale)}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
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

        {hasBlockers ? (
          <div
            className={cn(
              'mt-4 shrink-0 border-t border-border pt-4',
              docked ? 'flex min-h-0 flex-1 flex-col gap-2 overflow-hidden' : 'space-y-3',
            )}
          >
            <div className="shrink-0 space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {locale === 'de' ? 'Unvollständige Pflichtfelder' : 'Incomplete mandatory fields'}
                </p>
                <p className="text-xl font-bold tabular-nums text-red-600">
                  {passportSummary.missingCount}
                </p>
              </div>
              <Button
                type="button"
                size="default"
                variant="default"
                className="h-11 w-full cursor-pointer px-4 text-sm font-semibold shadow-sm"
                onClick={() => setBulkOutreachOpen(true)}
              >
                {locale === 'de'
                  ? 'Lieferantenanfrage für alle Felder'
                  : 'Request all fields from suppliers'}
              </Button>
            </div>
            {docked ? (
              <ScrollArea className="min-h-0 flex-1 pr-1">{blockerList}</ScrollArea>
            ) : (
              blockerList
            )}
          </div>
        ) : null}
        </CardContent>
      </Card>

      <SupplierOutreachDialog
        open={outreachKey !== null}
        draftId={params.draftId}
        field={outreachView}
        onClose={() => setOutreachKey(null)}
        onSend={() => {
          if (outreachKey) {
            markPassportSupplierPending(outreachKey);
          }
          setOutreachKey(null);
        }}
      />
      <SupplierOutreachDialog
        open={bulkOutreachOpen}
        draftId={params.draftId}
        field={null}
        bulkFields={bulkOutreachViews}
        onClose={() => setBulkOutreachOpen(false)}
        onSend={() => {
          markPassportSuppliersPending(blockerKeys);
          setBulkOutreachOpen(false);
        }}
      />
    </div>
  );
}
