import { V2_DASHBOARD_NAV } from '@/app/dashboard/v2/lib/navItems';

export type V2BreadcrumbItem = {
  label: string;
  href?: string;
};

const WIZARD_STEP_LABELS: Record<string, string> = {
  upload: 'Upload',
  'review-data': 'Daten prüfen',
  gaps: 'Lücken',
  check: 'Freigabe',
  publish: 'Veröffentlichen',
};

function workspaceCrumb(): V2BreadcrumbItem {
  return { label: 'Workspace', href: '/dashboard/v2' };
}

export function buildV2Breadcrumbs(
  pathname: string,
  editorProductName?: string | null,
): V2BreadcrumbItem[] {
  if (pathname === '/dashboard/v2') {
    return [{ label: 'Workspace' }];
  }

  const crumbs: V2BreadcrumbItem[] = [workspaceCrumb()];

  if (pathname.startsWith('/dashboard/v2/passports/new')) {
    crumbs.push({ label: 'Produktpässe', href: '/dashboard/v2/produktpaesse' });
    if (pathname === '/dashboard/v2/passports/new') {
      crumbs.push({ label: 'Neuer Pass' });
      return crumbs;
    }
    const segments = pathname.split('/').filter(Boolean);
    const draftIdIndex = segments.indexOf('new') + 1;
    const draftId = segments[draftIdIndex];
    const step = segments[draftIdIndex + 1];
    const wizardBase = `/dashboard/v2/passports/new/${draftId}`;
    crumbs.push({ label: 'Neuer Pass', href: `${wizardBase}/upload` });
    if (step) {
      crumbs.push({ label: WIZARD_STEP_LABELS[step] ?? step });
    }
    return crumbs;
  }

  const editorMatch = pathname.match(/^\/dashboard\/v2\/passports\/([^/]+)\/editor/);
  if (editorMatch) {
    crumbs.push({ label: 'Produktpässe', href: '/dashboard/v2/produktpaesse' });
    crumbs.push({
      label: editorProductName?.trim() || 'Pass bearbeiten',
    });
    return crumbs;
  }

  const nav = V2_DASHBOARD_NAV.find((item) => item.match(pathname));
  if (nav) {
    if (pathname === nav.href) {
      crumbs.push({ label: nav.label });
    } else {
      crumbs.push({ label: nav.label, href: nav.href });
      crumbs.push({ label: 'Detail' });
    }
    return crumbs;
  }

  crumbs.push({ label: 'Seite' });
  return crumbs;
}
