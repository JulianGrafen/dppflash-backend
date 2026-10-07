import { describe, expect, it } from 'vitest';
import {
  firstIncompleteWizardStep,
  isWizardStepReachable,
} from '@/app/dashboard/v2/lib/wizardStepAccess';

describe('wizardStepAccess', () => {
  it('blocks skipping ahead in the wizard', () => {
    expect(isWizardStepReachable(['upload'], 'gaps')).toBe(false);
    expect(isWizardStepReachable(['upload', 'review-data'], 'gaps')).toBe(true);
  });

  it('picks the next incomplete step', () => {
    expect(firstIncompleteWizardStep(['upload'])).toBe('review-data');
    expect(firstIncompleteWizardStep(['upload', 'review-data', 'gaps', 'check', 'publish'])).toBe(
      'publish',
    );
  });
});
