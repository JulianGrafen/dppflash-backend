import Link from 'next/link';
import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from 'cn';

type ReadinessBlockerFieldCardProps = {
  href: string;
  title: string;
  categoryLabel: string;
  description: string;
  className?: string;
  action?: ReactNode;
};

export function ReadinessBlockerFieldCard({
  href,
  title,
  categoryLabel,
  description,
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
            title={title}
          >
            <AlertTriangle className="h-4 w-4 text-red-600" strokeWidth={2} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
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
