import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  FileText,
  Package,
  QrCode,
  Settings,
  Users,
} from 'lucide-react';

export type V2NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
};

export const V2_DASHBOARD_NAV: V2NavItem[] = [
  {
    href: '/dashboard/v2/produktpaesse',
    label: 'Produktpässe',
    icon: Package,
    match: (p) =>
      p === '/dashboard/v2/produktpaesse' ||
      p === '/dashboard/v2/produkte' ||
      p.startsWith('/dashboard/v2/produkte/') ||
      p === '/dashboard/v2/readiness' ||
      p === '/dashboard/v2/lieferanten' ||
      p.startsWith('/dashboard/v2/passports/new') ||
      /\/dashboard\/v2\/passports\/[^/]+\/editor/.test(p),
  },
  {
    href: '/dashboard/v2/dokumente',
    label: 'Dokumente',
    icon: FileText,
    match: (p) => p === '/dashboard/v2/dokumente',
  },
  {
    href: '/dashboard/v2/qr-codes',
    label: 'QR-Codes',
    icon: QrCode,
    match: (p) => p === '/dashboard/v2/qr-codes',
  },
  {
    href: '/dashboard/v2/analytics',
    label: 'Analytics',
    icon: BarChart3,
    match: (p) => p === '/dashboard/v2/analytics',
  },
  {
    href: '/dashboard/v2/team',
    label: 'Team',
    icon: Users,
    match: (p) => p === '/dashboard/v2/team',
  },
  {
    href: '/dashboard/v2/einstellungen',
    label: 'Einstellungen',
    icon: Settings,
    match: (p) => p === '/dashboard/v2/einstellungen',
  },
];
