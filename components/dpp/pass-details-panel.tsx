import type { ReactNode } from 'react';

import { cn } from 'cn';

/** Animated expand/collapse wrapper for native `<details>` (parent must be `.dpp-pass`). */
export function PassDetailsPanel({
  children,
  bodyClassName,
}: {
  children: ReactNode;
  bodyClassName?: string;
}) {
  return (
    <div className="pass-details-panel">
      <div className="pass-details-panel-inner">
        <div className={cn('pass-details-panel-body', bodyClassName)}>{children}</div>
      </div>
    </div>
  );
}

export const passDetailsChevronClass = 'pass-details-chevron size-4 shrink-0';

export const passDetailsSummaryClass =
  'pass-details-summary flex cursor-pointer list-none transition-colors hover:bg-muted/60 [&::-webkit-details-marker]:hidden';
