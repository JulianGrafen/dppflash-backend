'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';
import type { PassportFieldDefinition } from '@/app/domain/battery/passportFieldCatalog';
import type { PassportFieldValueState } from '@/app/dashboard/v2/mock/types';
import { passportFieldNeedsReview } from '@/app/dashboard/v2/mock/passportFields';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { cn } from 'cn';
import { resolvePassportFieldSource } from '@/app/dashboard/v2/mock/passportFieldSource';
import { PassportFieldAuditTrail } from './PassportFieldAuditTrail';
import { accessTierShort } from './editorUi';

type FieldStatusPillsProps = {
  readonly def: PassportFieldDefinition;
  readonly state: PassportFieldValueState;
  readonly isAiSuggestion: boolean;
  readonly surface: 'collapsed' | 'expanded';
};

function FieldStatusPills({ def, state, isAiSuggestion, surface }: FieldStatusPillsProps) {
  const tierSurface = surface === 'expanded' ? 'bg-white' : 'bg-slate-50';

  return (
    <div className="flex shrink-0 flex-nowrap items-center justify-end gap-1.5">
      <span
        className={cn(
          'rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-500',
          tierSurface,
        )}
        title={def.accessTier}
      >
        {accessTierShort(def.accessTier)}
      </span>
      {state.mandatory ? (
        <Badge variant="secondary" className="shrink-0 text-[10px]">Mandatory</Badge>
      ) : null}
      {isAiSuggestion ? (
        <span className="inline-flex shrink-0 items-center gap-0.5 text-[10px] font-medium text-violet-700">
          <Sparkles className="h-3 w-3" aria-hidden />
          {surface === 'expanded' ? `AI ${Math.round(state.confidence * 100)}%` : 'AI'}
        </span>
      ) : null}
      {state.provenance === 'confirmed' ? (
        <Badge className="shrink-0 bg-emerald-100 text-[10px] text-emerald-900 hover:bg-emerald-100">
          OK
        </Badge>
      ) : null}
    </div>
  );
}

type PassportFieldCardProps = {
  readonly def: PassportFieldDefinition;
  readonly state: PassportFieldValueState;
  readonly sectionDetailsOpen: boolean;
  readonly onCloseSectionDetails: () => void;
  readonly onUpdate: (value: string) => void;
  readonly onConfirm: () => void;
};

export function PassportFieldCard({
  def,
  state,
  sectionDetailsOpen,
  onCloseSectionDetails,
  onUpdate,
  onConfirm,
}: PassportFieldCardProps) {
  const [hashExpanded, setHashExpanded] = useState(false);
  const [userExpanded, setUserExpanded] = useState(false);
  const needsReview = passportFieldNeedsReview(state);
  const isAiSuggestion = needsReview && state.provenance === 'ai';
  const isBlocker = state.mandatory && !state.value?.trim();
  const inputId = `field-${def.key.replace(/\./g, '-')}`;
  const fieldAnchorId = `field-${def.key}`;

  useEffect(() => {
    function syncHash() {
      const hash = window.location.hash.slice(1);
      const isTarget = hash === fieldAnchorId;
      setHashExpanded(isTarget);
      if (!isTarget) {
        setUserExpanded(false);
      }
    }
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, [fieldAnchorId]);

  const expanded = sectionDetailsOpen || hashExpanded || userExpanded;
  const auditSource =
    state.source ?? resolvePassportFieldSource(def.key, state);

  function openField() {
    setUserExpanded(true);
    if (window.location.hash.slice(1) !== fieldAnchorId) {
      window.location.hash = fieldAnchorId;
    }
  }

  function handleClose() {
    setUserExpanded(false);
    if (sectionDetailsOpen) {
      onCloseSectionDetails();
      return;
    }
    if (hashExpanded) {
      const { pathname, search } = window.location;
      window.history.replaceState(null, '', `${pathname}${search}`);
      setHashExpanded(false);
    }
  }

  if (!expanded) {
    return (
      <article
        id={fieldAnchorId}
        role="button"
        tabIndex={0}
        aria-expanded={false}
        onClick={openField}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openField();
          }
        }}
        className={cn(
          'scroll-mt-28 cursor-pointer rounded-xl border px-4 py-3 transition-colors bg-white hover:bg-slate-50/90',
          isBlocker
            ? 'border-red-400'
            : isAiSuggestion
              ? 'border-violet-200 bg-violet-50/30'
              : 'border-slate-200/90',
        )}
      >
        <div className="flex items-center gap-3">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{def.label}</span>
          <FieldStatusPills
            def={def}
            state={state}
            isAiSuggestion={isAiSuggestion}
            surface="collapsed"
          />
        </div>
      </article>
    );
  }

  return (
    <article
      id={fieldAnchorId}
      aria-expanded={true}
      className={cn(
        'scroll-mt-28 rounded-xl border p-4 transition-colors bg-slate-50/30',
        isBlocker
          ? 'border-red-400'
          : isAiSuggestion
            ? 'border-violet-200 bg-violet-50/40'
            : 'border-slate-200/90',
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <Label htmlFor={inputId} className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
          {def.label}
        </Label>
        <FieldStatusPills
          def={def}
          state={state}
          isAiSuggestion={isAiSuggestion}
          surface="expanded"
        />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="shrink-0 cursor-pointer gap-1 text-slate-600"
          onClick={handleClose}
        >
          <ChevronDown className="h-4 w-4 rotate-180" aria-hidden />
          Schließen
        </Button>
      </div>

      <p className="mb-3 text-xs leading-relaxed text-slate-500">{def.note}</p>

      {def.datatype === 'TEXT list' ? (
        <Textarea
          id={inputId}
          rows={3}
          className="bg-white"
          value={state.value}
          onChange={(e) => onUpdate(e.target.value)}
        />
      ) : (
        <Input
          id={inputId}
          className="bg-white"
          value={state.value}
          onChange={(e) => onUpdate(e.target.value)}
        />
      )}

      {isBlocker ? (
        <p className="mt-2 text-xs font-medium text-red-700">Pflichtfeld fehlt — Publish-Blocker.</p>
      ) : null}

      {auditSource ? (
        <PassportFieldAuditTrail
          fieldLabel={def.label}
          source={auditSource}
          confidence={state.confidence}
        />
      ) : null}

      {isAiSuggestion ? (
        <div className="mt-3 flex flex-wrap gap-2">
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
            className="cursor-pointer text-slate-600"
            onClick={() => onUpdate('')}
          >
            Dismiss
          </Button>
        </div>
      ) : needsReview ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-3 cursor-pointer"
          onClick={() => {
            onConfirm();
            handleClose();
          }}
        >
          Bestätigen
        </Button>
      ) : null}
    </article>
  );
}
