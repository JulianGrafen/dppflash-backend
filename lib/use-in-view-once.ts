import { useEffect, useRef, type RefObject } from 'react';

/** Runs callback once when element enters the viewport; always runs after fallbackMs if IO never fires. */
export function useInViewOnce(
  ref: RefObject<Element | null>,
  onVisible: () => void,
  options?: { threshold?: number; rootMargin?: string; fallbackMs?: number },
) {
  const onVisibleRef = useRef(onVisible);
  onVisibleRef.current = onVisible;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let fired = false;
    const fire = () => {
      if (fired) return;
      fired = true;
      onVisibleRef.current();
    };

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      fire();
      return;
    }

    const fallbackMs = options?.fallbackMs ?? 2500;
    const fallback = window.setTimeout(fire, fallbackMs);

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        window.clearTimeout(fallback);
        fire();
      },
      {
        threshold: options?.threshold ?? 0.12,
        rootMargin: options?.rootMargin ?? '0px 0px -4% 0px',
      },
    );

    io.observe(el);

    return () => {
      io.disconnect();
      window.clearTimeout(fallback);
    };
  }, [options?.fallbackMs, options?.rootMargin, options?.threshold, ref]);
}
