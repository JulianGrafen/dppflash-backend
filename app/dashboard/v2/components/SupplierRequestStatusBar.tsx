import type { SupplierRequestView } from '@/app/dashboard/v2/lib/supplierRequestView';
import { cn } from 'cn';

const STEPS = ['Nicht gesendet', 'Gesendet', 'Durchgeführt'] as const;

export function supplierOutreachStepIndex(field: SupplierRequestView): number {
  if (field.provenance === 'confirmed') {
    return 2;
  }
  if (field.provenance === 'pending_supplier') {
    return 1;
  }
  return 0;
}

export function SupplierRequestStatusBar({
  field,
  className,
}: {
  readonly field: SupplierRequestView;
  readonly className?: string;
}) {
  const activeIndex = supplierOutreachStepIndex(field);

  return (
    <div className={cn('mt-3 w-full max-w-xl', className)} role="group" aria-label="Anfragestatus">
      <ol className="grid grid-cols-3">
        {STEPS.map((label, index) => {
          const complete = index < activeIndex;
          const active = index === activeIndex;
          const isFirst = index === 0;
          const isLast = index === STEPS.length - 1;
          const segmentBeforeComplete = index > 0 && activeIndex >= index;
          const segmentAfterComplete = !isLast && activeIndex > index;

          return (
            <li key={label} className="flex min-w-0 flex-col items-center">
              <div className="relative flex h-5 w-full items-center justify-center">
                {!isFirst ? (
                  <span
                    className={cn(
                      'absolute top-1/2 right-1/2 left-0 h-1 -translate-y-1/2 rounded-full',
                      segmentBeforeComplete ? 'bg-primary' : 'bg-muted',
                    )}
                    aria-hidden
                  />
                ) : null}
                <span
                  className={cn(
                    'relative z-10 box-border size-2.5 shrink-0 rounded-full border-2 border-background shadow-sm',
                    (complete || active) && 'border-primary bg-primary',
                    !complete && !active && 'border-muted-foreground/25 bg-muted',
                    active && 'ring-2 ring-primary/30 ring-offset-2 ring-offset-card',
                  )}
                  aria-current={active ? 'step' : undefined}
                />
                {!isLast ? (
                  <span
                    className={cn(
                      'absolute top-1/2 left-1/2 right-0 h-1 -translate-y-1/2 rounded-full',
                      segmentAfterComplete ? 'bg-primary' : 'bg-muted',
                    )}
                    aria-hidden
                  />
                ) : null}
              </div>
              <span
                className={cn(
                  'mt-2 w-full px-1 text-center text-[10px] font-medium leading-snug sm:text-[11px]',
                  active && 'font-semibold text-primary',
                  !active && (complete ? 'text-foreground' : 'text-muted-foreground'),
                )}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
