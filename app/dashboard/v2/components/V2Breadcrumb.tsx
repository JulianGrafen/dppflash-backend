'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { buildV2Breadcrumbs } from '@/app/dashboard/v2/lib/v2Breadcrumbs';
import { loadDraft } from '@/app/dashboard/v2/mock/storage';
import { cn } from 'cn';

export function V2Breadcrumb({ className }: { readonly className?: string }) {
  const pathname = usePathname() ?? '';
  const [editorProductName, setEditorProductName] = useState<string | null>(null);

  useEffect(() => {
    const match = pathname.match(/\/dashboard\/v2\/passports\/([^/]+)\/editor/);
    if (!match) {
      setEditorProductName(null);
      return;
    }
    setEditorProductName(loadDraft(match[1])?.productName ?? null);
  }, [pathname]);

  const crumbs = useMemo(
    () => buildV2Breadcrumbs(pathname, editorProductName),
    [pathname, editorProductName],
  );

  if (crumbs.length === 0) {
    return null;
  }

  return (
    <nav
      className={cn('flex flex-wrap items-center justify-end gap-1 text-xs', className)}
      aria-label="Pfad"
    >
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        return (
          <span key={`${crumb.label}-${index}`} className="inline-flex items-center gap-1">
            {index > 0 ? (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" aria-hidden />
            ) : null}
            {crumb.href && !isLast ? (
              <Link
                href={crumb.href}
                className="max-w-[10rem] truncate font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline sm:max-w-[14rem]"
              >
                {crumb.label}
              </Link>
            ) : (
              <span
                className={cn(
                  'max-w-[12rem] truncate sm:max-w-[18rem]',
                  isLast ? 'font-semibold text-foreground' : 'text-muted-foreground',
                )}
                aria-current={isLast ? 'page' : undefined}
              >
                {crumb.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
