'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';

import {
  PassDetailsPanel,
  passDetailsChevronClass,
  passDetailsSummaryClass,
} from '@/components/dpp/pass-details-panel';
import { passTokens } from '@/components/dpp/pass-tokens';
import { cn } from 'cn';

function HeaderAction({ label, href }: { label: string; href: string }) {
  const external = href.startsWith('http');
  return (
    <Link
      href={href}
      className={passTokens.headerActionBtn}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {label}
    </Link>
  );
}

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

export function PassSectionCard({
  id,
  title,
  children,
  collapsible,
  defaultOpen,
  meta,
  headerAction,
}: {
  id: string;
  title: string;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  meta?: string;
  headerAction?: { label: string; href: string };
}) {
  const headingId = `pass-section-${id}`;

  if (collapsible) {
    return (
      <section className={passTokens.card} aria-labelledby={headingId}>
        <details className="group" {...(defaultOpen ? { defaultOpen: true } : {})}>
          <summary
            className={cn(
              passDetailsSummaryClass,
              'flex flex-col items-stretch gap-2',
              passTokens.borderB,
              passTokens.px,
              'py-3',
            )}
          >
            <div className="flex w-full items-center gap-3">
              <h2 id={headingId} className={cn('min-w-0 flex-1 text-left', passTokens.textSection)}>
                {title}
              </h2>
              <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
                {meta ? <span className="text-xs tabular-nums">{meta}</span> : null}
                <ChevronIcon className={passDetailsChevronClass} />
              </span>
            </div>
            {headerAction ? (
              <div className="w-full" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                <HeaderAction {...headerAction} />
              </div>
            ) : null}
          </summary>
          <PassDetailsPanel bodyClassName={cn(passTokens.px, 'py-2.5')}>{children}</PassDetailsPanel>
        </details>
      </section>
    );
  }

  return (
    <section className={passTokens.card} aria-labelledby={headingId}>
      <header className={cn(passTokens.borderB, passTokens.px, 'py-3')}>
        <h2 id={headingId} className={passTokens.textSection}>
          {title}
        </h2>
        {headerAction ? <HeaderAction {...headerAction} /> : null}
      </header>
      <div className={cn(passTokens.px, 'py-2.5')}>{children}</div>
    </section>
  );
}
