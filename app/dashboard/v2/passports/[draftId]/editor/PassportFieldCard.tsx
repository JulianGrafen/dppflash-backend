'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronDown, Sparkles } from 'lucide-react';
import type { PassportFieldDefinition } from '@/app/domain/battery/passportFieldCatalog';
import { passportFieldEditorNote } from '@/app/domain/battery/passportFieldEditorNote';
import { passportFieldLabel } from '@/app/domain/battery/passportFieldI18n';
import type { PassportFieldValueState } from '@/app/dashboard/v2/mock/types';
import { passportFieldNeedsReview } from '@/app/dashboard/v2/mock/passportFields';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { cn } from 'cn';
import type { EditorContentLocale } from './EditorContentLocaleContext';
import {
  fieldSupportsLocalization,
  fieldValueForContentLocale,
  passportFieldHasValue,
} from '@/app/dashboard/v2/mock/passportFieldLocalization';
import { resolvePassportFieldSource } from '@/app/dashboard/v2/mock/passportFieldSource';
import { PassportFieldAuditTrail } from './PassportFieldAuditTrail';
import { accessTierShort } from './editorUi';

type FieldStatusPillsProps = {
  readonly def: PassportFieldDefinition;
  readonly state: PassportFieldValueState;
  readonly isAiSuggestion: boolean;
  readonly surface: 'collapsed' | 'expanded';
};

function FieldComplianceCheck({ compliant }: { readonly compliant: boolean }) {
  if (!compliant) {
    return null;
  }
  return (
    <span
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200/80"
      title="Vollständig & compliant"
      aria-label="Compliant"
    >
      <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
    </span>
  );
}

function FieldStatusPills({
  def,
  state,
  isAiSuggestion,
  surface,
  contentLocale,
}: FieldStatusPillsProps & { contentLocale: EditorContentLocale }) {
  const tierSurface = surface === 'expanded' ? 'bg-card' : 'bg-muted/40';

  return (
    <div className="flex shrink-0 flex-nowrap items-center justify-end gap-1.5">
      <span
        className={cn(
          'rounded border border-border px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground',
          tierSurface,
        )}
        title={def.accessTier}
      >
        {accessTierShort(def.accessTier)}
      </span>
      {state.mandatory ? (
        <Badge variant="secondary" className="shrink-0 text-[10px]">
          {contentLocale === 'de' ? 'Pflichtfeld' : 'Mandatory'}
        </Badge>
      ) : null}
      {isAiSuggestion ? (
        <span className="inline-flex shrink-0 items-center gap-0.5 text-[10px] font-medium text-violet-700">
          <Sparkles className="h-3 w-3" aria-hidden />
          {surface === 'expanded' ? `AI ${Math.round(state.confidence * 100)}%` : 'AI'}
        </span>
      ) : null}
    </div>
  );
}

function fieldCardSurfaceClass(
  isBlocker: boolean,
  isCompliant: boolean,
  isAiSuggestion: boolean,
): string {
  if (isBlocker) {
    return 'border-red-400';
  }
  if (isCompliant) {
    return 'border-emerald-200/90 bg-emerald-50/20';
  }
  if (isAiSuggestion) {
    return 'border-violet-200 bg-violet-50/30';
  }
  return 'border-border bg-card';
}

type PassportFieldCardProps = {
  readonly def: PassportFieldDefinition;
  readonly state: PassportFieldValueState;
  readonly contentLocale: EditorContentLocale;
  readonly sectionDetailsOpen: boolean;
  readonly onCloseSectionDetails: () => void;
  readonly onUpdate: (value: string, locale?: 'de' | 'en') => void;
  readonly onConfirm: () => void;
};

export function PassportFieldCard({
  def,
  state,
  contentLocale,
  sectionDetailsOpen,
  onCloseSectionDetails,
  onUpdate,
  onConfirm,
}: PassportFieldCardProps) {
  const [userExpanded, setUserExpanded] = useState(false);
  const needsReview = passportFieldNeedsReview(state);
  const isAiSuggestion = needsReview && state.provenance === 'ai';
  const isBlocker = state.mandatory && !passportFieldHasValue(state, def);
  const isCompliant = passportFieldHasValue(state, def) && !passportFieldNeedsReview(state);
  const activeLocale = fieldSupportsLocalization(def) ? contentLocale : undefined;
  const displayValue = activeLocale
    ? fieldValueForContentLocale(state, activeLocale)
    : state.value;
  const fieldLabel = passportFieldLabel(def, contentLocale);
  const fieldNote = passportFieldEditorNote(def, contentLocale);
  const inputId = `field-${def.key.replace(/\./g, '-')}`;
  const fieldAnchorId = `field-${def.key}`;

  useEffect(() => {
    function syncFromHash() {
      const hash = window.location.hash.slice(1);
      if (hash === fieldAnchorId) {
        setUserExpanded(true);
        return;
      }
      if (hash.startsWith('field-')) {
        setUserExpanded(false);
      }
    }
    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, [fieldAnchorId]);

  const expanded = sectionDetailsOpen || userExpanded;
  const auditSource =
    state.source ?? resolvePassportFieldSource(def.key, state);

  function openField() {
    setUserExpanded(true);
  }

  function handleClose() {
    setUserExpanded(false);
    if (sectionDetailsOpen) {
      onCloseSectionDetails();
      return;
    }
    if (window.location.hash.slice(1) === fieldAnchorId) {
      const { pathname, search } = window.location;
      window.history.replaceState(null, '', `${pathname}${search}`);
    }
  }

  function handleOpenChange(open: boolean) {
    if (open) {
      openField();
      return;
    }
    handleClose();
  }

  const surfaceClass = fieldCardSurfaceClass(isBlocker, isCompliant, isAiSuggestion);

  return (
    <Collapsible open={expanded} onOpenChange={handleOpenChange}>
      <article
        id={fieldAnchorId}
        className={cn(
          'overflow-hidden rounded-xl border shadow-sm transition-[box-shadow,border-color] duration-200 motion-safe:hover:shadow-md',
          surfaceClass,
          expanded && 'bg-muted/20',
        )}
      >
        <CollapsibleTrigger
          className={cn(
            'flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left outline-none transition-colors duration-150',
            'hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset',
            !expanded && 'motion-safe:active:scale-[0.995]',
          )}
        >
          <FieldComplianceCheck compliant={isCompliant} />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
            {fieldLabel}
          </span>
          <FieldStatusPills
            def={def}
            state={state}
            isAiSuggestion={isAiSuggestion}
            surface={expanded ? 'expanded' : 'collapsed'}
            contentLocale={contentLocale}
          />
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
              expanded && 'rotate-180',
            )}
            aria-hidden
          />
        </CollapsibleTrigger>

        <CollapsibleContent className="border-t border-border/60">
          <div className="space-y-3 px-4 py-4">
            <Label htmlFor={inputId} className="sr-only">
              {fieldLabel}
            </Label>
            {fieldNote ? (
              <p className="text-xs leading-relaxed text-muted-foreground">{fieldNote}</p>
            ) : null}

            {def.datatype === 'TEXT list' ? (
              <Textarea
                id={inputId}
                rows={3}
                className="bg-background"
                value={displayValue}
                onChange={(e) => onUpdate(e.target.value, activeLocale)}
              />
            ) : (
              <Input
                id={inputId}
                className="bg-background"
                value={displayValue}
                onChange={(e) => onUpdate(e.target.value, activeLocale)}
              />
            )}

            {isBlocker ? (
              <p className="text-xs font-medium text-red-700">
                {contentLocale === 'de'
                  ? 'Pflichtfeld fehlt. Freigabe blockiert.'
                  : 'Mandatory field missing. Blocks publish.'}
              </p>
            ) : null}

            {auditSource ? (
              <PassportFieldAuditTrail
                fieldLabel={fieldLabel}
                source={auditSource}
                confidence={state.confidence}
                contentLocale={contentLocale}
              />
            ) : null}

            {isAiSuggestion ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="cursor-pointer"
                  onClick={() => {
                    onConfirm();
                    handleClose();
                  }}
                >
                  Accept
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="cursor-pointer text-muted-foreground"
                  onClick={() => onUpdate('', activeLocale)}
                >
                  Dismiss
                </Button>
              </div>
            ) : needsReview ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="cursor-pointer"
                onClick={() => {
                  onConfirm();
                  handleClose();
                }}
              >
                Bestätigen
              </Button>
            ) : null}
          </div>
        </CollapsibleContent>
      </article>
    </Collapsible>
  );
}
