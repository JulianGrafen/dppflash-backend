import { describe, expect, it } from 'vitest';
import {
  companyMasterDataFromIntegrations,
  isCompanyMasterDataValid,
  suggestedCompanyNameFromDomain,
} from '@/app/dashboard/v2/onboarding/companyMasterData';

describe('companyMasterData', () => {
  it('suggests a company name from domain', () => {
    expect(suggestedCompanyNameFromDomain('acme.corp')).toBe('Acme GmbH');
  });

  it('validates required fields', () => {
    const base = companyMasterDataFromIntegrations({}, 'demo.de');
    expect(isCompanyMasterDataValid(base)).toBe(false);
    expect(
      isCompanyMasterDataValid({
        ...base,
        city: 'Berlin',
      }),
    ).toBe(true);
  });
});
