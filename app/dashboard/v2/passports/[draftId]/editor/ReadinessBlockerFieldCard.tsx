import Link from 'next/link';
import type { ReactNode } from 'react';
import { AlertTriangle, CircleX } from 'lucide-react';
import { cn } from 'cn';

type ReadinessBlockerFieldCardProps = {
  href: string;
  title: string;
  categoryLabel: string;
  description: string;
  statusLabel?: string;
  className?: string;
  action?: ReactNode;
};

export function ReadinessBlockerFieldCard({
  href,
  title,
  categoryLabel,
  description,
  statusLabel = 'Blocked',
  className,
  action,
}: ReadinessBlockerFieldCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card text-card-foreground shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:border-border/80 motion-safe:hover:shadow-md',
        className,
      )}
    >
      <Link
        href={href}
        scroll={false}
        className="block rounded-t-xl p-4 pb-3 transition-colors hover:bg-muted/40"
      >
        <div className="flex gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50"
            aria-hidden
          >
            <AlertTriangle className="h-4 w-4 text-red-600" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <span
              className="mb-1.5 inline-flex w-fit max-w-full items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold leading-none text-red-700"
            >
              <CircleX className="h-3 w-3 shrink-0" aria-hidden />
              {statusLabel}
            </span>
          <p className="text-sm font-semibold leading-snug text-foreground break-words">{title}</p>
          <p className="mt-1 text-xs leading-snug text-muted-foreground break-words">{categoryLabel}</p>
          <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground break-words">
              {description}
            </p>
          </div>
        </div>
      </Link>
      {action ? <div className="border-t border-border px-4 py-3">{action}</div> : null}
    </div>
  );
}
