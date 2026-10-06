'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { PASSPORT_SECTIONS } from '@/app/domain/battery/passportFieldCatalog';
import type { PassportSectionId } from '@/app/domain/battery/passportFieldCatalog';
import { useDraft } from '@/app/dashboard/v2/context/DraftProvider';
import { cn } from 'cn';
import { sectionNavLabel, sectionProgressTone } from './editorUi';

export function PassportSectionNav() {
  const params = useParams<{ draftId: string }>();
  const searchParams = useSearchParams();
  const active = (searchParams.get('section') as PassportSectionId) ?? 'identity';
  const { passportSummary } = useDraft();

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-100 px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Overall readiness</p>
        <div className="mt-2 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-sky-600 transition-all"
              style={{ width: `${passportSummary.completenessPercent}%` }}
            />
          </div>
          <span className="text-sm font-semibold tabular-nums text-slate-700">
            {passportSummary.completenessPercent}%
          </span>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2" aria-label="Passport-Sektionen">
        {PASSPORT_SECTIONS.map((section, index) => {
          const stats = passportSummary.sections.find((s) => s.sectionId === section.id);
          const filled = stats?.filled ?? 0;
          const total = stats?.total ?? 0;
          const missingMandatory = stats?.missingMandatory ?? 0;
          const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
          const isActive = section.id === active;
          const tone = sectionProgressTone(filled, total, missingMandatory);

          return (
            <Link
              key={section.id}
              href={`/dashboard/v2/passports/${params.draftId}/editor?section=${section.id}`}
              className={cn(
                'block cursor-pointer rounded-lg px-3 py-2.5 transition-colors',
                isActive ? 'bg-slate-100 ring-1 ring-slate-200/80' : 'hover:bg-slate-50',
              )}
            >
              <div className="flex items-start gap-2">
                <span className="mt-0.5 w-6 shrink-0 text-[11px] font-semibold tabular-nums text-slate-400">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        'truncate text-sm font-medium',
                        isActive ? 'text-[#0c1929]' : 'text-slate-700',
                      )}
                    >
                      {sectionNavLabel(section.title)}
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-slate-500">
                      {filled}/{total}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className={cn('h-full rounded-full transition-all', tone)} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
