import type { DraftField } from '@/app/dashboard/v2/mock/types';
import { cn } from 'cn';

const STEPS = ['Nicht gesendet', 'Gesendet', 'Durchgeführt'] as const;

export function supplierOutreachStepIndex(field: DraftField): number {
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
  readonly field: DraftField;
  readonly className?: string;
}) {
  const activeIndex = supplierOutreachStepIndex(field);

  return (
    <div className={cn('mt-3 max-w-md', className)} role="group" aria-label="Anfragestatus">
      <div className="flex items-center">
        {STEPS.map((label, index) => {
          const done = index < activeIndex;
          const active = index === activeIndex;
          const isLast = index === STEPS.length - 1;

          return (
            <div key={label} className={cn('flex items-center', !isLast && 'flex-1')}>
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className={cn(
                    'flex h-3 w-3 shrink-0 rounded-full border-2 transition-colors',
                    (done || active) && 'border-primary bg-primary',
                    !done && !active && 'border-slate-200 bg-white',
                    active && 'ring-2 ring-primary/20',
                  )}
                  aria-current={active ? 'step' : undefined}
                />
                <span
                  className={cn(
                    'max-w-[5.5rem] text-center text-[10px] font-medium leading-tight sm:max-w-none',
                    active || done ? 'text-slate-800' : 'text-slate-400',
                  )}
                >
                  {label}
                </span>
              </div>
              {!isLast ? (
                <div
                  className={cn(
                    'mx-1 mb-5 h-0.5 flex-1 min-w-[1rem] rounded-full',
                    index < activeIndex ? 'bg-primary' : 'bg-slate-200',
                  )}
                  aria-hidden
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
