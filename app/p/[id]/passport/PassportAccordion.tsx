import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** Passper-style accordion container (single white card, stacked panels). */
export function PassportAccordionShell({ children }: { readonly children: ReactNode }) {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_28px_-6px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/[0.04]"
    >
      {children}
    </div>
  );
}

type PassportAccordionPanelProps = {
  readonly title: string;
  readonly icon?: LucideIcon;
  readonly defaultOpen?: boolean;
  readonly children: ReactNode;
};

export function PassportAccordionPanel({
  title,
  icon: Icon,
  defaultOpen = false,
  children,
}: PassportAccordionPanelProps) {
  return (
    <details
      className="group border-b border-slate-200/90 last:border-b-0"
      open={defaultOpen ? true : undefined}
    >
      <summary
        className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-slate-50/80 [&::-webkit-details-marker]:hidden"
      >
        <span className="flex min-w-0 items-center gap-3 text-[15px] font-semibold tracking-tight text-[#0c1929]">
          {Icon ? (
            <Icon className="h-[17px] w-[17px] shrink-0 text-teal-700" strokeWidth={2} aria-hidden />
          ) : null}
          {title}
        </span>
        <span
          className="shrink-0 text-lg font-medium text-slate-400 transition-transform duration-200 group-open:rotate-90"
          aria-hidden
        >
          ›
        </span>
      </summary>
      <div className="border-t border-slate-100/80 px-5 pb-4 pt-1">{children}</div>
    </details>
  );
}

type PassportKvRowProps = {
  readonly label: string;
  readonly value?: string | number;
  readonly multiline?: boolean;
  readonly sourceBadge?: string;
};

export function PassportKvRow({ label, value, multiline, sourceBadge }: PassportKvRowProps) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const text = String(value);

  return (
    <div
      className={`flex gap-4 border-b border-dashed border-slate-200/90 py-2.5 text-[13px] last:border-b-0 ${
        multiline ? 'flex-col sm:flex-col' : 'flex-row items-start justify-between'
      }`}
    >
      <span className="shrink-0 text-slate-500">{label}</span>
      <span
        className={`font-semibold text-slate-900 ${
          multiline ? 'whitespace-pre-line leading-relaxed' : 'text-right sm:max-w-[58%]'
        }`}
      >
        {text}
        {sourceBadge ? (
          <span
            className="ml-2 inline-flex align-middle rounded-md bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-900"
            title="Aus dem hochgeladenen Dokument (RAG-Index) übernommen"
          >
            {sourceBadge}
          </span>
        ) : null}
      </span>
    </div>
  );
}
