import { describe, expect, it } from 'vitest';
import { buildV2Breadcrumbs } from '@/app/dashboard/v2/lib/v2Breadcrumbs';

describe('buildV2Breadcrumbs', () => {
  it('returns workspace only on hub', () => {
    expect(buildV2Breadcrumbs('/dashboard/v2')).toEqual([{ label: 'Workspace' }]);
  });

  it('nests produkte under produktpaesse hub', () => {
    const crumbs = buildV2Breadcrumbs('/dashboard/v2/produkte');
    expect(crumbs).toEqual([
      { label: 'Workspace', href: '/dashboard/v2' },
      { label: 'Produktpässe', href: '/dashboard/v2/produktpaesse' },
      { label: 'Produkte' },
    ]);
  });

  it('includes editor product name when provided', () => {
    const crumbs = buildV2Breadcrumbs('/dashboard/v2/passports/d1/editor', 'E-Bike Battery Pro');
    expect(crumbs.at(-1)).toEqual({
      label: 'E-Bike Battery Pro',
      href: '/dashboard/v2/passports/d1/editor',
    });
    expect(crumbs[1]).toEqual({ label: 'Produktpässe', href: '/dashboard/v2/produktpaesse' });
  });
});
