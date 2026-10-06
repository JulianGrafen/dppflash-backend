'use client';

import type { PassportFieldDefinition } from '@/app/domain/battery/passportFieldCatalog';
import type { PassportFieldValueState } from '@/app/dashboard/v2/mock/types';
import { Button } from '@/components/ui/button';
import { categoryGroupLabel } from './editorUi';
import { PassportFieldCard } from './PassportFieldCard';

type PassportFieldCategoryPanelProps = {
  readonly categoryPrefix: string;
  readonly fields: readonly PassportFieldDefinition[];
  readonly fieldStates: Record<string, PassportFieldValueState>;
  readonly detailsOpen: boolean;
  readonly onToggleDetails: () => void;
  readonly onCloseDetails: () => void;
  readonly onUpdate: (key: string, value: string) => void;
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
  if (fields.length === 0) {
    return null;
  }

  const title = categoryGroupLabel(categoryPrefix);

  return (
    <div className="rounded-xl border border-slate-200/90 bg-white shadow-sm">
      <header className="border-b border-slate-100 px-6 py-4">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{title}</p>
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
              sectionDetailsOpen={detailsOpen}
              onCloseSectionDetails={onCloseDetails}
              onUpdate={(value) => onUpdate(def.key, value)}
              onConfirm={() => onConfirm(def.key)}
            />
          );
        })}
      </div>
    </div>
  );
}
