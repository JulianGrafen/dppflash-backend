'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { PASSPORT_SECTIONS } from '@/app/domain/battery/passportFieldCatalog';
import type { PassportSectionId } from '@/app/domain/battery/passportFieldCatalog';
import { useDraft } from '@/app/dashboard/v2/context/DraftProvider';
import { cn } from 'cn';
import { useEditorContentLocale } from './EditorContentLocaleContext';
import { sectionNavLabel, sectionProgressTone } from './editorUi';

export function PassportSectionNav() {
  const params = useParams<{ draftId: string }>();
  const searchParams = useSearchParams();
  const active = (searchParams.get('section') as PassportSectionId) ?? 'identity';
  const { passportSummary } = useDraft();
  const { locale } = useEditorContentLocale();

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {locale === 'de' ? 'Gesamt-Readiness' : 'Overall readiness'}
        </p>
        <div className="mt-2 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${passportSummary.completenessPercent}%` }}
            />
          </div>
          <span className="text-sm font-semibold tabular-nums text-foreground">
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
                isActive ? 'bg-accent text-accent-foreground ring-1 ring-border' : 'hover:bg-muted/60',
              )}
            >
              <div className="flex items-start gap-2">
                <span className="mt-0.5 w-6 shrink-0 text-[11px] font-semibold tabular-nums text-muted-foreground">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        'truncate text-sm font-medium',
                        isActive ? 'text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {locale === 'en' ? sectionNavLabel(section.title) : section.title}
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {filled}/{total}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
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
