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
          <span
            className="mb-1.5 inline-flex w-fit max-w-full items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold leading-none text-red-700"
          >
            <CircleX className="h-3 w-3 shrink-0" aria-hidden />
            {statusLabel}
          </span>
          <p className="text-sm font-semibold leading-snug text-[#0c1929] break-words">{title}</p>
          <p className="mt-1 text-xs leading-snug text-slate-500 break-words">{categoryLabel}</p>
          <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-600 break-words">{description}</p>
        </div>
      </div>
    </Link>
  );
}
