'use client';

import { useId, useState } from 'react';
import { Info } from 'lucide-react';
import { PROXY_BENCHMARK_BADGE, PROXY_BENCHMARK_TOOLTIP } from '@/app/domain/dpp/environmentalFootprintBenchmarks';

type FootprintMetricRowProps = {
  readonly label: string;
  readonly value: string;
  readonly isProxyBenchmark?: boolean;
  readonly tooltipText?: string;
};

function ProxyBenchmarkInfo({ tooltipText }: { readonly tooltipText: string }) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-sky-50 hover:text-sky-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
        aria-label="Informationen zur Schätzung"
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((prev) => !prev)}
      >
        <Info size={14} strokeWidth={2} aria-hidden />
      </button>
      {open ? (
        <span
          id={tooltipId}
          role="tooltip"
          className="absolute left-1/2 top-full z-20 mt-2 w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-[11px] font-normal leading-snug text-slate-700 shadow-lg ring-1 ring-slate-900/5"
        >
          {tooltipText}
        </span>
      ) : null}
    </span>
  );
}

/** **Einzelne Kennzahl** im Umweltblock inkl. Proxy-Badge und Info-Tooltip. */
export function FootprintMetricRow({
  label,
  value,
  isProxyBenchmark = false,
  tooltipText = PROXY_BENCHMARK_TOOLTIP,
}: FootprintMetricRowProps) {
  return (
    <div className="flex flex-col gap-1.5 px-5 py-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <dt className="flex items-center gap-1.5 text-[13px] font-medium leading-snug text-slate-500 sm:w-[40%] sm:shrink-0">
        <span>{label}</span>
        {isProxyBenchmark ? <ProxyBenchmarkInfo tooltipText={tooltipText} /> : null}
      </dt>
      <dd className="flex flex-col items-start gap-2 sm:max-w-[58%] sm:items-end">
        <span className="text-[13px] font-semibold text-slate-900">{value}</span>
        {isProxyBenchmark ? (
          <span className="inline-flex rounded-md bg-sky-100 px-2 py-0.5 text-[10px] font-semibold leading-snug text-sky-900 ring-1 ring-sky-200/80">
            {PROXY_BENCHMARK_BADGE}
          </span>
        ) : null}
      </dd>
    </div>
  );
}
