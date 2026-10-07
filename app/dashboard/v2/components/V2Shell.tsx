'use client';

import { usePathname } from 'next/navigation';
import { V2BrandLogo } from '@/app/dashboard/v2/components/V2BrandLogo';
import { V2Sidebar } from '@/app/dashboard/v2/components/V2Sidebar';

export function V2Shell({ children }: { readonly children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === '/dashboard/v2/login';
  const isOnboarding = pathname === '/dashboard/v2/onboarding';

  if (isLogin || isOnboarding) {
    return children;
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <V2Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center border-b border-border bg-card px-4 md:hidden">
          <V2BrandLogo />
        </header>
        <main className="flex-1 p-5 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
