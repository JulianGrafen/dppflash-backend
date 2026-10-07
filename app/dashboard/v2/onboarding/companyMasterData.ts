import type { V2IntegrationsState } from '@/app/dashboard/v2/mock/storage';

export type CompanyMasterDataForm = {
  companyName: string;
  industry: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  vatId: string;
};

export const INDUSTRY_OPTIONS = [
  'Importer / Distributor',
  'Manufacturer (OEM)',
  'Retail & E-Commerce',
  'Aftermarket & Service',
  'Other',
] as const;

export function suggestedCompanyNameFromDomain(domain: string): string {
  const slug = domain.split('.')[0]?.trim() || 'Unternehmen';
  const label = slug.charAt(0).toUpperCase() + slug.slice(1);
  return `${label} GmbH`;
}

export function companyMasterDataFromIntegrations(
  integrations: V2IntegrationsState | undefined,
  companyDomain: string,
): CompanyMasterDataForm {
  return {
    companyName: integrations?.companyName?.trim() || suggestedCompanyNameFromDomain(companyDomain),
    industry: integrations?.industry?.trim() || INDUSTRY_OPTIONS[0],
    street: integrations?.street?.trim() || '',
    postalCode: integrations?.postalCode?.trim() || '',
    city: integrations?.city?.trim() || '',
    country: integrations?.country?.trim() || 'Deutschland',
    vatId: integrations?.vatId?.trim() || '',
  };
}

export function isCompanyMasterDataValid(data: CompanyMasterDataForm): boolean {
  return (
    data.companyName.trim().length >= 2 &&
    data.industry.trim().length > 0 &&
    data.city.trim().length >= 2 &&
    data.country.trim().length >= 2
  );
}

export function toIntegrationsPatch(data: CompanyMasterDataForm): Partial<V2IntegrationsState> {
  return {
    companyName: data.companyName.trim(),
    industry: data.industry.trim(),
    street: data.street.trim(),
    postalCode: data.postalCode.trim(),
    city: data.city.trim(),
    country: data.country.trim(),
    vatId: data.vatId.trim(),
  };
}
