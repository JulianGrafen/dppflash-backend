import type { ReactNode } from 'react';

import {
  PassDetailsPanel,
  passDetailsChevronClass,
  passDetailsSummaryClass,
} from '@/components/dpp/pass-details-panel';
import { passTokens } from '@/components/dpp/pass-tokens';
import { cn } from 'cn';

function ChevronIcon({ className }: { className?: string }) {
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
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function PassDisclosure({
  title,
  summary,
  meta,
  children,
  className,
}: {
  title: string;
  summary?: string;
  meta?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details className={cn('group', passTokens.borderT, className)}>
      <summary
        className={cn(
          passDetailsSummaryClass,
          'flex items-center gap-3 py-2.5',
          '-mx-4 px-4',
          'text-sm font-medium text-foreground',
        )}
      >
        <span className={cn('min-w-0 flex-1 text-left', passTokens.textSection)}>
          {title}
        </span>
        <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
          {summary ? (
            <span className={cn('max-w-[9rem] truncate text-xs sm:max-w-[11rem]', passTokens.textValue)}>
              {summary}
            </span>
          ) : null}
          {meta ? <span className="text-xs tabular-nums">{meta}</span> : null}
          <ChevronIcon className={passDetailsChevronClass} />
        </span>
      </summary>
      <PassDetailsPanel bodyClassName="pb-0.5 pt-1">{children}</PassDetailsPanel>
    </details>
  );
}
