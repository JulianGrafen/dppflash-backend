import Link from 'next/link';
import { AlertTriangle, CircleX } from 'lucide-react';
import { cn } from 'cn';

type ReadinessBlockerFieldCardProps = {
  href: string;
  title: string;
  categoryLabel: string;
  description: string;
  statusLabel?: string;
  className?: string;
};

export function ReadinessBlockerFieldCard({
  href,
  title,
  categoryLabel,
  description,
  statusLabel = 'Blocked',
  className,
}: ReadinessBlockerFieldCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        'block rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50/40',
        className,
      )}
    >
      <div className="flex gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50"
          aria-hidden
        >
          <AlertTriangle className="h-4 w-4 text-red-600" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold leading-snug text-[#0c1929]">{title}</p>
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700"
            >
              <CircleX className="h-3 w-3" aria-hidden />
              {statusLabel}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">{categoryLabel}</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">{description}</p>
        </div>
      </div>
    </Link>
  );
}
