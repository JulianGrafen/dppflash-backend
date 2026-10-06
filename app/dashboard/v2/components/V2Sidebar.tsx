'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, Moon } from 'lucide-react';
import { useSession } from '@/app/dashboard/v2/context/SessionProvider';
import { V2_DASHBOARD_NAV } from '@/app/dashboard/v2/lib/navItems';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { V2BrandLogo } from '@/app/dashboard/v2/components/V2BrandLogo';

export function V2Sidebar() {
  const pathname = usePathname() ?? '';
  const { session, logout } = useSession();

  const displayName = session?.email
    ? session.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Nutzer';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200/90 bg-white md:flex">
      <div className="flex h-14 items-center gap-2 border-b border-white/10 bg-[#0c1929] px-4">
        <V2BrandLogo className="min-w-0 flex-1 [&_img]:max-h-9" priority href="/dashboard/v2" />
        <button
          type="button"
          className="cursor-pointer rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white"
          aria-label="Sidebar einklappen (Demo)"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex flex-1 flex-col overflow-y-auto p-4">
        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Dashboard
        </p>
        <div className="space-y-0.5">
          {V2_DASHBOARD_NAV.map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="mt-auto border-t border-slate-200/80 p-4">
        <div className="mb-3 flex items-center justify-between rounded-lg border border-slate-200/80 px-3 py-2">
          <span className="text-xs text-slate-600">Dark Mode</span>
          <button
            type="button"
            className="cursor-pointer rounded-md p-1 text-slate-400"
            aria-label="Dark Mode (Demo, inaktiv)"
          >
            <Moon className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-2 text-center text-[10px] text-slate-400">
          <span className="underline">Impressum</span>
          {' · '}
          <span className="underline">Datenschutz</span>
          {' · '}
          <span className="underline">AGB</span>
        </p>

        <Separator className="my-3" />

        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary"
            aria-hidden
          >
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
            <p className="truncate text-xs text-slate-500">{session?.companyDomain ?? '—'}</p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2 w-full cursor-pointer justify-start px-0 text-slate-600 hover:text-slate-900"
          onClick={logout}
        >
          Abmelden
        </Button>
      </div>
    </aside>
  );
}
