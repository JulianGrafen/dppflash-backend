import { describe, expect, it } from 'vitest';
import { buildIngestDocumentVault } from '@/app/dashboard/v2/dokumente/documentsIngestMock';

describe('documentsIngestMock', () => {
  it('builds folder tree for tenant inbox domain', () => {
    const vault = buildIngestDocumentVault('acme.de');
    expect(vault.length).toBeGreaterThanOrEqual(5);
    expect(vault[0]?.name).toContain('import-data@acme.de');
    const total = vault.reduce((n, f) => n + f.files.length, 0);
    expect(total).toBeGreaterThan(10);
  });
});
