'use client';

import { Activity } from 'lucide-react';
import type { PassportFieldDefinition } from '@/app/domain/battery/passportFieldCatalog';
import type { PassportFieldValueState } from '@/app/dashboard/v2/mock/types';
import { passportFieldHasValue } from '@/app/dashboard/v2/mock/passportFieldLocalization';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from 'cn';
import { categoryGroupLabel } from './editorUi';
import { useEditorContentLocale } from './EditorContentLocaleContext';
import { PassportFieldCard } from './PassportFieldCard';

type PassportFieldCategoryPanelProps = {
  readonly categoryPrefix: string;
  readonly fields: readonly PassportFieldDefinition[];
  readonly fieldStates: Record<string, PassportFieldValueState>;
  readonly detailsOpen: boolean;
  readonly onToggleDetails: () => void;
  readonly onCloseDetails: () => void;
  readonly onUpdate: (key: string, value: string, locale?: 'de' | 'en') => void;
  readonly onConfirm: (key: string) => void;
};

export function PassportFieldCategoryPanel({
  categoryPrefix,
  fields,
  fieldStates,
  detailsOpen,
  onToggleDetails,
  onCloseDetails,
  onUpdate,
  onConfirm,
}: PassportFieldCategoryPanelProps) {
  const { locale: contentLocale } = useEditorContentLocale();
  const isTelemetry = categoryPrefix === 'telemetry';

  if (fields.length === 0) {
    return null;
  }

  const title = categoryGroupLabel(categoryPrefix, contentLocale);

  const filledCount = fields.filter((def) => {
    const state = fieldStates[def.key];
    return state && passportFieldHasValue(state, def);
  }).length;

  return (
    <div
      className={cn(
        'rounded-xl border shadow-sm',
        isTelemetry
          ? 'border-sky-200/90 bg-gradient-to-b from-sky-50/50 to-white'
          : 'border-slate-200/90 bg-white',
      )}
    >
      <header className="border-b border-slate-100/80 px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {isTelemetry ? (
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-sky-800">
                  <Activity className="h-4 w-4" aria-hidden />
                </span>
                <Badge variant="secondary" className="bg-sky-100 text-[10px] text-sky-900 hover:bg-sky-100">
                  BMS · API
                </Badge>
              </div>
            ) : null}
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{title}</p>
            {isTelemetry ? (
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                {contentLocale === 'de'
                  ? 'Individuelle Laufzeitdaten — SoH, SoC, Zyklen, Temperaturen (Demo-Sync).'
                  : 'Individual runtime data — SoH, SoC, cycles, temperatures (demo sync).'}
              </p>
            ) : null}
          </div>
          {isTelemetry ? (
            <p className="text-left text-xs tabular-nums text-slate-600">
              <span className="font-semibold text-slate-800">{filledCount}</span>
              <span className="text-slate-500"> / {fields.length} befüllt</span>
            </p>
          ) : null}
        </div>
        <div className="mt-3 flex justify-center">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-w-[8.5rem] cursor-pointer"
            onClick={onToggleDetails}
          >
            {detailsOpen ? 'Kompakt' : 'Details'}
          </Button>
        </div>
      </header>

      <div className="space-y-3 p-6">
        {fields.map((def) => {
          const state = fieldStates[def.key];
          if (!state) {
            return null;
          }

          return (
            <PassportFieldCard
              key={def.key}
              def={def}
              state={state}
              contentLocale={contentLocale}
              sectionDetailsOpen={detailsOpen}
              onCloseSectionDetails={onCloseDetails}
              onUpdate={(value, locale) => onUpdate(def.key, value, locale)}
              onConfirm={() => onConfirm(def.key)}
            />
          );
        })}
      </div>
    </div>
  );
}
