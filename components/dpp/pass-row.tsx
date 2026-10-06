'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';

import type { DppPassMaterialOrigin } from '@/app/_data/sample-dpp.data';
import { usePassLocale } from '@/components/dpp/pass-locale-context';
import { passTokens } from '@/components/dpp/pass-tokens';
import { cn } from 'cn';

export function PassRow({
  label,
  value,
  href,
  boolean,
  listItems,
  as = 'li',
  className,
}: {
  label: string;
  value: string;
  href?: string;
  boolean?: boolean;
  listItems?: DppPassMaterialOrigin[];
  as?: 'li' | 'div';
  className?: string;
}) {
  const { ui } = usePassLocale();
  let valueNode: ReactNode;

  if (listItems && listItems.length > 0) {
    valueNode = (
      <ul className="flex flex-col gap-1.5">
        {listItems.map((item) => (
          <li
            key={item.name}
            className="flex items-baseline justify-between gap-3 border-b border-[#e8ecf2] pb-1.5 last:border-0 last:pb-0"
          >
            <span className={passTokens.textRowValue}>{item.name}</span>
            <span className={cn('shrink-0 text-right text-[0.68rem] tabular-nums', passTokens.textMuted)}>
              {[item.share, item.origin].filter(Boolean).join(' · ')}
            </span>
          </li>
        ))}
      </ul>
    );
  } else if (boolean !== undefined) {
    valueNode = (
      <span
        className={cn(
          'inline-flex items-center gap-1.5',
          passTokens.textRowValue,
          boolean ? 'text-emerald-700' : 'text-[#64748b]',
        )}
      >
        <span
          className={cn(
            'size-1.5 shrink-0 rounded-full',
            boolean ? 'bg-emerald-500' : 'bg-[#cbd5e1]',
          )}
          aria-hidden
        />
        {boolean ? ui.yes : ui.no}
      </span>
    );
  } else if (href) {
    const external = href.startsWith('http');
    valueNode = (
      <Link
        href={href}
        className={passTokens.rowActionBtn}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {value}
      </Link>
    );
  } else {
    valueNode = <span className={cn(passTokens.textRowValue, 'text-pretty')}>{value}</span>;
  }

  const Tag = as;

  if (href) {
    return (
      <Tag
        className={cn(
          'flex flex-row items-center justify-between gap-3 py-2.5',
          className,
        )}
      >
        <span className={cn(passTokens.textLabel, 'min-w-0 flex-1 text-pretty')}>{label}</span>
        {valueNode}
      </Tag>
    );
  }

  return (
    <Tag className={cn('flex flex-col gap-0.5 py-2', className)}>
      <span className={passTokens.textLabel}>{label}</span>
      <div className="min-w-0">{valueNode}</div>
    </Tag>
  );
}
