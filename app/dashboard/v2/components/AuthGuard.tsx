'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useSession } from '@/app/dashboard/v2/context/SessionProvider';

export function AuthGuard({ children }: { readonly children: React.ReactNode }) {
  const { session, ready, isOnboardingComplete } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === '/dashboard/v2/login';
  const isOnboarding = pathname === '/dashboard/v2/onboarding';

  useEffect(() => {
    if (!ready) {
      return;
    }
    if (!session && !isLogin) {
      router.replace('/dashboard/v2/login');
      return;
    }
    if (session && isLogin) {
      router.replace(isOnboardingComplete ? '/dashboard/v2' : '/dashboard/v2/onboarding');
      return;
    }
    if (session && !isOnboardingComplete && !isLogin && !isOnboarding) {
      router.replace('/dashboard/v2/onboarding');
      return;
    }
    if (session && isOnboardingComplete && isOnboarding) {
      router.replace('/dashboard/v2');
    }
  }, [ready, session, isLogin, isOnboarding, isOnboardingComplete, router]);

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
        Laden…
      </div>
    );
  }

  if (!session && !isLogin) {
    return null;
  }

  if (session && !isOnboardingComplete && !isLogin && !isOnboarding) {
    return null;
  }

  return children;
}
