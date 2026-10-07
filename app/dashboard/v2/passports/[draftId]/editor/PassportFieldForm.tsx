'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  PASSPORT_SECTIONS,
  getFieldsForSection,
  type PassportSectionId,
} from '@/app/domain/battery/passportFieldCatalog';
import { useDraft } from '@/app/dashboard/v2/context/DraftProvider';
import { useEditorContentLocale } from './EditorContentLocaleContext';
import { PassportFieldCategoryPanel } from './PassportFieldCategoryPanel';
import { sectionNavLabel } from './editorUi';
import { groupFieldsByCategoryPrefix } from './passportFieldGroups';

export function PassportFieldForm() {
  const searchParams = useSearchParams();
  const sectionId = (searchParams.get('section') as PassportSectionId) ?? 'identity';
  const section = PASSPORT_SECTIONS.find((s) => s.id === sectionId);
  const { draft, updatePassportField, confirmPassportField } = useDraft();
  const { locale } = useEditorContentLocale();
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setOpenCategories({});
  }, [sectionId]);

  if (!draft?.passportFields || !section) {
    return null;
  }

  const fields = getFieldsForSection(sectionId);
  const sectionIndex = PASSPORT_SECTIONS.findIndex((s) => s.id === sectionId) + 1;
  const categoryGroups = groupFieldsByCategoryPrefix(fields, section, draft.passportFields);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200/90 bg-white px-6 py-5 shadow-sm">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {locale === 'de' ? 'Sektion' : 'Section'} {String(sectionIndex).padStart(2, '0')}
          </p>
          <h2 className="mt-1 text-xl font-semibold text-[#0c1929]">
            {locale === 'en' ? sectionNavLabel(section.title) : section.title}
          </h2>
        </div>
      </div>

      {categoryGroups.map((group) => (
        <PassportFieldCategoryPanel
          key={group.prefix}
          categoryPrefix={group.prefix}
          fields={group.fields}
          fieldStates={draft.passportFields!}
          detailsOpen={Boolean(openCategories[group.prefix])}
          onToggleDetails={() =>
            setOpenCategories((prev) => ({
              ...prev,
              [group.prefix]: !prev[group.prefix],
            }))
          }
          onCloseDetails={() =>
            setOpenCategories((prev) => ({
              ...prev,
              [group.prefix]: false,
            }))
          }
          onUpdate={updatePassportField}
          onConfirm={confirmPassportField}
        />
      ))}
    </div>
  );
}
