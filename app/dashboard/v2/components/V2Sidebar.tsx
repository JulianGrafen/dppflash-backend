'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, LogOut, Moon } from 'lucide-react';
import { useSession } from '@/app/dashboard/v2/context/SessionProvider';
import { V2_DASHBOARD_NAV } from '@/app/dashboard/v2/lib/navItems';
import { cn } from 'cn';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { V2BrandLogo } from '@/app/dashboard/v2/components/V2BrandLogo';

const SIDEBAR_COLLAPSED_KEY = 'dppflash_v2_sidebar_collapsed';

export function V2Sidebar() {
  const pathname = usePathname() ?? '';
  const { session, logout } = useSession();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1');
    } catch {
      /* ignore */
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const displayName = session?.email
    ? session.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Nutzer';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <aside
      className={cn(
        'hidden shrink-0 flex-col border-r border-slate-200/90 bg-white transition-[width] duration-200 ease-out md:flex',
        collapsed ? 'w-[4.5rem]' : 'w-64',
      )}
    >
      <div
        className={cn(
          'flex h-14 shrink-0 items-center border-b border-white/10 bg-[#0c1929]',
          collapsed ? 'justify-center px-2' : 'gap-2 px-3',
        )}
      >
        {!collapsed ? (
          <V2BrandLogo className="min-w-0 flex-1 [&_img]:max-h-9" priority href="/dashboard/v2" />
        ) : null}
        <button
          type="button"
          className="cursor-pointer rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
          aria-label={collapsed ? 'Sidebar ausklappen' : 'Sidebar einklappen'}
          aria-expanded={!collapsed}
          onClick={toggleCollapsed}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" aria-hidden />
          ) : (
            <ChevronLeft className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>

      <nav className="flex flex-1 flex-col overflow-y-auto p-2" aria-label="Hauptnavigation">
        {!collapsed ? (
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Dashboard
          </p>
        ) : null}
        <div className="space-y-0.5">
          {V2_DASHBOARD_NAV.map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            const linkClassName = cn(
              'flex cursor-pointer items-center rounded-lg text-sm font-medium transition-colors',
              collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5',
              active
                ? 'bg-primary/10 text-primary'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
            );
            const link = (
              <Link key={item.href} href={item.href} className={linkClassName}>
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {!collapsed ? <span className="truncate">{item.label}</span> : null}
                {collapsed ? <span className="sr-only">{item.label}</span> : null}
              </Link>
            );
            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger render={link} />
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              );
            }
            return link;
          })}
        </div>
      </nav>

      <div className={cn('mt-auto border-t border-slate-200/80', collapsed ? 'p-2' : 'p-4')}>
        <div
          className={cn(
            'mb-3 flex items-center rounded-lg border border-slate-200/80',
            collapsed ? 'justify-center px-2 py-2' : 'justify-between px-3 py-2',
          )}
        >
          {!collapsed ? <span className="text-xs text-slate-600">Dark Mode</span> : null}
          <button
            type="button"
            className="cursor-pointer rounded-md p-1 text-slate-400"
            aria-label="Dark Mode (Demo, inaktiv)"
            title="Dark Mode"
          >
            <Moon className="h-4 w-4" />
          </button>
        </div>

        {!collapsed ? (
          <p className="mb-2 text-center text-[10px] text-slate-400">
            <span className="underline">Impressum</span>
            {' · '}
            <span className="underline">Datenschutz</span>
            {' · '}
            <span className="underline">AGB</span>
          </p>
        ) : null}

        <Separator className={cn('my-3', collapsed && 'my-2')} />

        <div className={cn('flex items-center', collapsed ? 'flex-col gap-2' : 'gap-3')}>
          <Avatar className="h-10 w-10" title={displayName}>
            <AvatarFallback className="bg-primary/15 text-sm font-semibold text-primary">
              {initial}
            </AvatarFallback>
          </Avatar>
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
              <p className="truncate text-xs text-slate-500">{session?.companyDomain ?? '—'}</p>
            </div>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size={collapsed ? 'icon' : 'sm'}
          className={cn(
            'mt-2 cursor-pointer text-slate-600 hover:text-slate-900',
            collapsed ? 'mx-auto' : 'w-full justify-start px-0',
          )}
          onClick={logout}
          aria-label="Abmelden"
          title="Abmelden"
        >
          {collapsed ? <LogOut className="h-4 w-4" aria-hidden /> : 'Abmelden'}
        </Button>
      </div>
    </aside>
  );
}
