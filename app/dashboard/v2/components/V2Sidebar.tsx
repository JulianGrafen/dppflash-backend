'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, LogOut, Settings } from 'lucide-react';
import { useSession } from '@/app/dashboard/v2/context/SessionProvider';
import { V2_DASHBOARD_NAV } from '@/app/dashboard/v2/lib/navItems';
import { cn } from 'cn';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DppflashLegalLinks } from '@/app/dashboard/v2/components/DppflashLegalLinks';
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
        'hidden shrink-0 flex-col border-r border-border bg-card text-card-foreground transition-[width] duration-200 ease-out md:flex',
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
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Dashboard
          </p>
        ) : null}
        <div className="space-y-0.5">
          {V2_DASHBOARD_NAV.map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            const linkClassName = cn(
              'flex cursor-pointer items-center rounded-lg text-sm font-medium transition-[background-color,color,transform] duration-150 motion-safe:active:scale-[0.98]',
              collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5',
              active
                ? 'bg-primary/10 text-primary shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
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

      <div className={cn('mt-auto border-t border-border', collapsed ? 'p-2' : 'p-4')}>
        {!collapsed ? (
          <DppflashLegalLinks className="mb-2 text-center text-[10px]" />
        ) : null}

        <Separator className={cn('my-3', collapsed && 'my-2')} />

        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              'flex w-full cursor-pointer items-center rounded-lg text-left outline-none transition-[background-color,box-shadow] duration-150 hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50',
              collapsed ? 'justify-center p-1' : 'gap-3 p-1',
            )}
            aria-label="Kontomenü"
          >
            <Avatar className="h-10 w-10" title={displayName}>
              <AvatarFallback className="bg-primary/15 text-sm font-semibold text-primary">
                {initial}
              </AvatarFallback>
            </Avatar>
            {!collapsed ? (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
                <p className="truncate text-xs text-muted-foreground">{session?.companyDomain ?? '—'}</p>
              </div>
            ) : null}
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align={collapsed ? 'center' : 'start'} className="w-52">
            <DropdownMenuLabel className="font-normal">
              <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
              <p className="truncate text-xs text-muted-foreground">{session?.email ?? '—'}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer"
              render={<Link href="/dashboard/v2/einstellungen" />}
            >
              <Settings className="h-4 w-4" aria-hidden />
              Einstellungen
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              className="cursor-pointer"
              onClick={logout}
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Abmelden
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
