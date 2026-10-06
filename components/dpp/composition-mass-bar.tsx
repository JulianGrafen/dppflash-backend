'use client';

import { useCallback, useRef, useState } from 'react';

import type { DppCompositionSegment } from '@/app/_data/sample-dpp.data';
import { easeOutCubic } from '@/lib/easing';
import { useInViewOnce } from '@/lib/use-in-view-once';
import { cn } from 'cn';

const DURATION_MS = 1300;
const SEGMENT_STAGGER = 0.1;

function formatKg(kg: number) {
  return kg.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function segmentProgress(overall: number, index: number) {
  const stagger = index * SEGMENT_STAGGER;
  const span = Math.max(0.35, 1 - stagger);
  const t = (overall - stagger) / span;
  return easeOutCubic(Math.max(0, Math.min(1, t)));
}

export function CompositionMassBar({
  segments,
  barSummary,
}: {
  segments: DppCompositionSegment[];
  barSummary: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);
  const [overall, setOverall] = useState(1);
  const [done, setDone] = useState(true);

  const startBarAnimation = useCallback(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    cancelAnimationFrame(frameRef.current);
    setOverall(0);
    setDone(false);

    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      setOverall(t);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        setOverall(1);
        setDone(true);
      }
    };

    frameRef.current = requestAnimationFrame(tick);
  }, []);

  useInViewOnce(ref, startBarAnimation, { threshold: 0.15 });

  return (
    <div
      ref={ref}
      className="flex h-11 w-full overflow-hidden rounded-lg sm:h-12"
      role="img"
      aria-label={`Massenverteilung: ${barSummary}`}
    >
      {segments.map((segment, index) => {
        const fill = segmentProgress(overall, index);
        const width = segment.percent * fill;
        const showLabels = fill >= 0.55;
        const animatedKg = segment.kg * fill;
        const animatedPercent = Math.round(segment.percent * fill);

        return (
          <div
            key={segment.label}
            className={cn(
              'relative flex h-full flex-col items-center justify-center gap-0.5 overflow-hidden px-1',
              done && segment.percent >= 12 ? 'min-w-[2.5rem]' : 'min-w-0',
              segment.colorClass,
              !done && fill > 0 && 'pass-composition-segment--active',
            )}
            style={{ width: `${width}%` }}
            title={`${segment.label}: ${formatKg(segment.kg)} kg (${segment.percent} %)`}
          >
            {showLabels && segment.percent >= 12 ? (
              <>
                <span
                  className={cn(
                    'max-w-full truncate text-[0.65rem] font-bold tabular-nums leading-none text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.35)] sm:text-[0.7rem]',
                    'transition-opacity duration-200',
                    showLabels ? 'opacity-100' : 'opacity-0',
                  )}
                >
                  {done ? formatKg(segment.kg) : formatKg(animatedKg)} kg
                </span>
                <span
                  className={cn(
                    'text-[0.58rem] font-semibold tabular-nums leading-none text-white/95 [text-shadow:0_1px_2px_rgba(0,0,0,0.3)] sm:text-[0.62rem]',
                    'transition-opacity duration-200',
                    showLabels ? 'opacity-100' : 'opacity-0',
                  )}
                >
                  {done ? segment.percent : animatedPercent} %
                </span>
              </>
            ) : showLabels ? (
              <span
                className={cn(
                  'text-[0.6rem] font-bold tabular-nums leading-none text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.35)] sm:text-[0.65rem]',
                  'transition-opacity duration-200',
                  showLabels ? 'opacity-100' : 'opacity-0',
                )}
              >
                {done ? segment.percent : animatedPercent} %
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
