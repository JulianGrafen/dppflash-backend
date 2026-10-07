import { WIZARD_STEPS, type WizardStep } from '@/app/dashboard/v2/mock/types';

/** Wizard tabs are linear: a step is reachable only after all prior steps were visited. */
export function isWizardStepReachable(visited: readonly string[], step: WizardStep): boolean {
  const idx = WIZARD_STEPS.indexOf(step);
  if (idx < 0) {
    return false;
  }
  for (let i = 0; i < idx; i += 1) {
    if (!visited.includes(WIZARD_STEPS[i])) {
      return false;
    }
  }
  return true;
}

export function firstIncompleteWizardStep(visited: readonly string[]): WizardStep {
  for (const step of WIZARD_STEPS) {
    if (!visited.includes(step)) {
      return step;
    }
  }
  return WIZARD_STEPS[WIZARD_STEPS.length - 1];
}
