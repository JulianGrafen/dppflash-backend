/** Stable mock tenant id from company e-mail domain. */
export function tenantIdFromDomain(companyDomain: string): string {
  const normalized = companyDomain.trim().toLowerCase().replace(/[^a-z0-9.-]/g, '');
  return `tenant_${normalized || 'unknown'}`;
}
