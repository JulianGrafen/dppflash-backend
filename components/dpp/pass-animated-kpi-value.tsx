'use client';

import { useCallback, useMemo, useRef, useState } from 'react';

import { passTokens } from '@/components/dpp/pass-tokens';
import { easeOutCubic } from '@/lib/easing';
import { formatKpiAnimatedValue, parseKpiValue } from '@/lib/kpi-value-animation';
import { useInViewOnce } from '@/lib/use-in-view-once';
import { cn } from 'cn';

const DURATION_MS = 1200;

export function PassAnimatedKpiValue({
  value,
  delayMs = 0,
}: {
  value: string;
  delayMs?: number;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const parsed = useMemo(() => parseKpiValue(value), [value]);
  const [display, setDisplay] = useState(value);
  const frameRef = useRef(0);

  const startCountUp = useCallback(() => {
    if (!parsed) {
      setDisplay(value);
      return;
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setDisplay(value);
      return;
    }

    cancelAnimationFrame(frameRef.current);
    setDisplay(formatKpiAnimatedValue(parsed, 0));

    const startAfterDelay = () => {
      const start = performance.now();

      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / DURATION_MS);
        const current = parsed.target * easeOutCubic(t);
        setDisplay(formatKpiAnimatedValue(parsed, current));
        if (t < 1) {
          frameRef.current = requestAnimationFrame(tick);
        } else {
          setDisplay(value);
        }
      };

      frameRef.current = requestAnimationFrame(tick);
    };

    if (delayMs > 0) {
      window.setTimeout(startAfterDelay, delayMs);
    } else {
      startAfterDelay();
    }
  }, [delayMs, parsed, value]);

  useInViewOnce(ref, startCountUp, { threshold: 0.1, rootMargin: '0px 0px -2% 0px' });

  return (
    <p ref={ref} className={cn(passTokens.textKpiValue)}>
      {display}
    </p>
  );
}
