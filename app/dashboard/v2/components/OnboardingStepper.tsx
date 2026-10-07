import { cn } from 'cn';

const STEPS = ['Stammdaten', 'Integrationen', 'Inbox', 'Sync', 'Katalog'] as const;

export function OnboardingStepper({ currentStep }: { readonly currentStep: number }) {
  return (
    <ol className="flex w-full items-start" aria-label="Onboarding-Fortschritt">
      {STEPS.map((label, index) => {
        const active = index === currentStep;
        const done = index < currentStep;
        const isLast = index === STEPS.length - 1;

        return (
          <li
            key={label}
            className={cn('flex items-start', !isLast && 'flex-1')}
            aria-current={active ? 'step' : undefined}
          >
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                  done && 'bg-primary text-primary-foreground',
                  active && !done && 'bg-primary/15 text-primary ring-2 ring-primary/30',
                  !active && !done && 'bg-slate-100 text-slate-500',
                )}
              >
                {index + 1}
              </span>
              <span
                className={cn(
                  'max-w-[4.5rem] text-center text-[10px] font-medium uppercase leading-tight tracking-wide sm:max-w-none',
                  active || done ? 'text-slate-900' : 'text-slate-500',
                )}
              >
                {label}
              </span>
            </div>
            {!isLast ? (
              <div
                className={cn(
                  'mx-1 mt-4 h-0.5 min-w-[1rem] flex-1 rounded-full',
                  index < currentStep ? 'bg-primary' : 'bg-slate-200',
                )}
                aria-hidden
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
