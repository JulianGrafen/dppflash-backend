'use client';

import { useParams, usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useDraft } from '@/app/dashboard/v2/context/DraftProvider';
import { firstIncompleteWizardStep, isWizardStepReachable } from '@/app/dashboard/v2/lib/wizardStepAccess';
import { CompletenessPanel } from '@/app/dashboard/v2/components/CompletenessPanel';
import { WizardStepper } from '@/app/dashboard/v2/components/WizardStepper';
import type { WizardStep } from '@/app/dashboard/v2/mock/types';
import { WIZARD_STEPS } from '@/app/dashboard/v2/mock/types';

function stepFromPath(pathname: string): WizardStep {
  const segment = pathname.split('/').pop() ?? 'upload';
  if (WIZARD_STEPS.includes(segment as WizardStep)) {
    return segment as WizardStep;
  }
  return 'upload';
}

export function WizardLayout({ children }: { readonly children: React.ReactNode }) {
  const params = useParams<{ draftId: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const { draft, summary } = useDraft();
  const step = stepFromPath(pathname ?? '');

  useEffect(() => {
    if (!draft) {
      return;
    }
    if (!isWizardStepReachable(draft.visitedSteps, step)) {
      const fallback = firstIncompleteWizardStep(draft.visitedSteps);
      router.replace(`/dashboard/v2/passports/new/${params.draftId}/${fallback}`);
    }
  }, [draft, params.draftId, router, step]);

  if (!draft) {
    return <p className="text-sm text-slate-500">Entwurf wird geladen…</p>;
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
      <div>
        <WizardStepper draftId={params.draftId} current={step} visited={draft.visitedSteps} />
        {children}
      </div>
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <CompletenessPanel
          draftId={params.draftId}
          summary={summary}
          fields={draft.fields}
          step={step}
        />
      </aside>
    </div>
  );
}
