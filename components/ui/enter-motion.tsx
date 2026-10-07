import type { CSSProperties, ReactNode } from 'react';
import { cn } from 'cn';

type EnterMotionProps = {
  readonly children: ReactNode;
  readonly className?: string;
  readonly delayMs?: number;
  readonly durationMs?: number;
};

/** tw-animate / shadcn-style entrance (fade + slight slide). */
export function EnterMotion({
  children,
  className,
  delayMs = 0,
  durationMs = 300,
}: EnterMotionProps) {
  const style: CSSProperties = {
    animationDuration: `${durationMs}ms`,
    ...(delayMs > 0 ? { animationDelay: `${delayMs}ms` } : {}),
  };

  return (
    <div
      className={cn(
        'animate-in fade-in slide-in-from-bottom-2 fill-mode-both motion-reduce:animate-none',
        className,
      )}
      style={style}
    >
      {children}
    </div>
  );
}

export function enterMotionDelay(index: number, stepMs = 50): number {
  return Math.min(index * stepMs, 400);
}
