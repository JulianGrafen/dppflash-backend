'use client';

import { useMemo, useState } from 'react';

import type { DppPassSectionId, DppRole, SampleDppPass } from '@/app/_data/sample-dpp.data';
import { getAllPassFields } from '@/app/_data/sample-dpp.data';
import { PassCarbonSection } from '@/components/dpp/pass-carbon-section';
import { CompositionBreakdown } from '@/components/dpp/composition-breakdown';
import { PassFieldList } from '@/components/dpp/pass-field-list';
import { PassKeyMetrics } from '@/components/dpp/pass-key-metrics';
import { PassSectionCard } from '@/components/dpp/pass-section-card';
import { usePassLocale } from '@/components/dpp/pass-locale-context';
import { passTokens } from '@/components/dpp/pass-tokens';
import { sectionHasVisibleFields, visibleForRole } from '@/components/dpp/pass-visibility';
import { cn } from 'cn';

const PUBLIC_ROLE: DppRole = 'public';

function sectionIsVisible(
  sectionId: DppPassSectionId,
  allFields: ReturnType<typeof getAllPassFields>,
  role: DppRole,
): boolean {
  if (sectionId === 'composition') return true;
  return sectionHasVisibleFields(sectionId, allFields, role);
}

function sectionMatchesQuery(
  pass: SampleDppPass,
  sectionId: DppPassSectionId,
  title: string,
  allFields: ReturnType<typeof getAllPassFields>,
  query: string,
): boolean {
  if (!query) return true;
  if (title.toLowerCase().includes(query)) return true;

  const fields = allFields.filter(
    (f) => f.sectionId === sectionId && visibleForRole(f.tier, PUBLIC_ROLE),
  );
  if (
    fields.some(
      (f) =>
        f.label.toLowerCase().includes(query) ||
        f.value.toLowerCase().includes(query) ||
        f.listItems?.some(
          (item) =>
            item.name.toLowerCase().includes(query) ||
            item.origin.toLowerCase().includes(query),
        ),
    )
  ) {
    return true;
  }

  if (sectionId === 'composition') {
    const { composition } = pass;
    return (
      composition.segments.some((s) => s.label.toLowerCase().includes(query)) ||
      composition.materials.some((m) => m.label.toLowerCase().includes(query))
    );
  }

  return false;
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function PassInteractiveBody({ pass }: { pass: SampleDppPass }) {
  const { ui } = usePassLocale();
  const [query, setQuery] = useState('');
  const allFields = getAllPassFields(pass);
  const contentSections = pass.contentSections ?? [];
  const normalizedQuery = query.trim().toLowerCase();

  const visibleSections = useMemo(() => {
    return contentSections
      .filter((section) => sectionIsVisible(section.id, allFields, PUBLIC_ROLE))
      .filter((section) =>
        sectionMatchesQuery(pass, section.id, section.title, allFields, normalizedQuery),
      );
  }, [pass, contentSections, allFields, normalizedQuery]);

  return (
    <>
      <div className={cn(passTokens.px, 'pb-3 pt-3')}>
        <label className="relative block">
          <span className="sr-only">{ui.searchAria}</span>
          <SearchIcon
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#64748b]"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={ui.searchPlaceholder}
            className={cn(
              'h-10 w-full rounded-xl border border-[#e8ecf2] bg-white pl-9 pr-3',
              'text-[0.8125rem] text-[#1a2b4a] shadow-sm placeholder:text-[#94a3b8]',
              'outline-none ring-[#2563eb]/30 transition-shadow focus:border-[#2563eb] focus:ring-2',
            )}
            autoComplete="off"
            enterKeyHint="search"
          />
        </label>
      </div>

      <PassKeyMetrics
        capacity={pass.capacity}
        cycleLife={pass.cycleLife}
        carbonFootprint={pass.carbonFootprint}
      />

      <div className={cn('flex flex-col gap-3 pb-4', passTokens.px)}>
        {visibleSections.length === 0 ? (
          <p className={cn('py-6 text-center text-sm', passTokens.textMuted)}>
            {ui.noResults.replace('{query}', query.trim())}
          </p>
        ) : null}
        {visibleSections.map((section) => (
          <PassSectionCard
            key={section.id}
            id={section.id}
            title={section.title}
            collapsible={section.collapsible}
            defaultOpen={
              section.collapsible
                ? normalizedQuery.length > 0 || Boolean(section.defaultOpen)
                : undefined
            }
            meta={
              section.collapsible && section.id !== 'repairability'
                ? ui.fieldsCount.replace(
                    '{count}',
                    String(
                      allFields.filter(
                        (f) =>
                          f.sectionId === section.id && visibleForRole(f.tier, PUBLIC_ROLE),
                      ).length,
                    ),
                  )
                : undefined
            }
            headerAction={section.headerAction}
          >
            {section.id === 'carbon' ? (
              <PassCarbonSection
                pass={pass}
                fields={allFields}
                fieldGroups={pass.publicSection.fieldGroups}
                role={PUBLIC_ROLE}
              />
            ) : section.id !== 'composition' ? (
              <PassFieldList
                sectionId={section.id}
                fields={allFields}
                fieldGroups={pass.publicSection.fieldGroups}
                role={PUBLIC_ROLE}
              />
            ) : (
              <CompositionBreakdown
                composition={pass.composition}
                role={PUBLIC_ROLE}
                detailFields={allFields.filter(
                  (f) => f.sectionId === 'composition' && visibleForRole(f.tier, PUBLIC_ROLE),
                )}
              />
            )}
          </PassSectionCard>
        ))}
      </div>
    </>
  );
}
