'use client';

import { useEffect, useState } from 'react';

import { usePassLocale } from '@/components/dpp/pass-locale-context';
import { easeOutCubic } from '@/lib/easing';
import { cn } from 'cn';

const heroGlass =
  'rounded-2xl border border-white/20 bg-slate-900/40 shadow-sm backdrop-blur-md';

const BAR_DURATION_MS = 1200;

export function PassHeroStatusRow({
  category,
  capacity,
  percent,
  note,
}: {
  category: string;
  capacity: string;
  percent: number;
  note?: string;
}) {
  const { ui } = usePassLocale();
  const status = Math.min(100, Math.max(0, Math.round(percent)));
  const [fillProgress, setFillProgress] = useState(1);
  const [barDone, setBarDone] = useState(true);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    setFillProgress(0);
    setBarDone(false);

    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / BAR_DURATION_MS);
      setFillProgress(easeOutCubic(t));
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        setFillProgress(1);
        setBarDone(true);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [status]);

  const displayedPercent = Math.round(status * fillProgress);
  const barWidth = status * fillProgress;

  return (
    <div
      className={cn(heroGlass, 'flex w-full items-center gap-2 px-2.5 py-2 sm:gap-2.5 sm:px-3')}
      aria-label={
        note
          ? `${ui.heroCapacity} ${status}% of ${capacity}. ${note}`
          : `${ui.heroCapacity} ${status}% of ${capacity}`
      }
    >
      <span
        className="shrink-0 rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[0.6rem] font-semibold uppercase tracking-wider text-white sm:text-[0.65rem]"
      >
        {category}
      </span>
      <span className="h-4 w-px shrink-0 bg-white/25" aria-hidden />
      {note ? (
        <span
          className="size-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_0_2px_rgba(52,211,153,0.35)]"
          title={note}
          aria-hidden
        />
      ) : null}
      <div
        className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/20"
        role="progressbar"
        aria-valuenow={displayedPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${ui.heroCapacity} ${status}%`}
      >
        <div
          className={cn(
            'pass-hero-bar-fill h-full rounded-full bg-gradient-to-r from-[#5b6cff] to-[#a78bfa]',
            !barDone && 'pass-hero-bar-fill--active',
          )}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <span
        className="flex shrink-0 flex-col items-center rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-center leading-tight"
        title={`${ui.heroCapacity} ${status}% (${capacity})`}
      >
        <span className="text-[0.5rem] font-medium uppercase tracking-wider text-white/75 sm:text-[0.52rem]">
          {ui.heroCapacity}
        </span>
        <span className="text-[0.62rem] font-semibold tabular-nums text-white sm:text-[0.65rem]">
          {displayedPercent}%
        </span>
      </span>
    </div>
  );
}
