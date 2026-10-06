'use client';

import Link from 'next/link';
import { WIZARD_STEPS, type WizardStep } from '@/app/dashboard/v2/mock/types';

const STEP_LABELS: Record<WizardStep, string> = {
  upload: 'Upload',
  'review-data': 'Daten',
  gaps: 'Lücken',
  check: 'Prüfung',
  publish: 'Veröffentlichen',
};

type WizardStepperProps = {
  readonly draftId: string;
  readonly current: WizardStep;
  readonly visited: readonly string[];
};

export function WizardStepper({ draftId, current, visited }: WizardStepperProps) {
  return (
    <nav aria-label="Fortschritt" className="mb-6 flex flex-wrap gap-2">
      {WIZARD_STEPS.map((step) => {
        const allowed = visited.includes(step) || step === current;
        const active = step === current;
        const href = `/dashboard/v2/passports/new/${draftId}/${step}`;
        if (!allowed) {
          return (
            <span
              key={step}
              className="rounded-full px-3 py-1 text-xs font-medium text-slate-400 ring-1 ring-slate-200"
            >
              {STEP_LABELS[step]}
            </span>
          );
        }
        return (
          <Link
            key={step}
            href={href}
            className={`cursor-pointer rounded-full px-3 py-1 text-xs font-semibold ring-1 transition-colors ${
              active
                ? 'bg-[#0c1929] text-white ring-[#0c1929]'
                : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {STEP_LABELS[step]}
          </Link>
        );
      })}
    </nav>
  );
}
