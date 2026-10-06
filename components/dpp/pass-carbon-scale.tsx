'use client';

import { usePassLocale } from '@/components/dpp/pass-locale-context';
import { passTokens } from '@/components/dpp/pass-tokens';
import { cn } from 'cn';

export type CarbonPerformanceClass = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

const GRADES: CarbonPerformanceClass[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

const GRADE_STYLES: Record<CarbonPerformanceClass, string> = {
  A: 'bg-[#1a9e55] text-white',
  B: 'bg-[#4cb848] text-white',
  C: 'bg-[#c8d400] text-[#1a2b4a]',
  D: 'bg-[#f5a623] text-[#1a2b4a]',
  E: 'bg-[#ef8a5a] text-white',
  F: 'bg-[#e57373] text-white',
  G: 'bg-[#8d6e63] text-white',
};

export function PassCarbonScale({
  activeClass,
  footnote,
}: {
  activeClass: CarbonPerformanceClass;
  footnote?: string;
}) {
  const { ui } = usePassLocale();

  return (
    <div className="pt-1">
      <p className={passTokens.textLabel}>{ui.carbonPerformanceClassLabel}</p>
      <div
        className="mt-2 flex items-end gap-0.5"
        role="img"
        aria-label={ui.carbonPerformanceClassAria.replace('{grade}', activeClass)}
      >
        {GRADES.map((grade) => {
          const isActive = grade === activeClass;
          return (
            <div
              key={grade}
              className={cn(
                'flex min-w-0 flex-1 items-center justify-center rounded-[3px] text-[0.65rem] font-bold leading-none transition-all sm:text-xs',
                GRADE_STYLES[grade],
                isActive ? 'h-9 py-1 shadow-sm sm:h-10' : 'h-6 opacity-45',
              )}
            >
              {grade}
            </div>
          );
        })}
      </div>
      {footnote ? (
        <p className={cn('mt-2 text-pretty text-[0.68rem] leading-snug', passTokens.textMuted)}>
          {footnote}
        </p>
      ) : null}
    </div>
  );
}
