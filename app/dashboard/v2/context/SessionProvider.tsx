'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { validateCorporateEmail } from '@/app/dashboard/v2/lib/corporateEmail';
import { tenantIdFromDomain } from '@/app/dashboard/v2/lib/tenantId';
import {
  clearSession,
  loadSession,
  normalizeSession,
  saveSession,
  type V2IntegrationsState,
  type V2OnboardingState,
  type V2Session,
} from '@/app/dashboard/v2/mock/storage';

type SessionContextValue = {
  session: V2Session | null;
  ready: boolean;
  login: (email: string) => { ok: true } | { ok: false; message: string };
  logout: () => void;
  updateSession: (patch: {
    onboarding?: Partial<V2OnboardingState>;
    integrations?: Partial<V2IntegrationsState>;
  }) => void;
  isOnboardingComplete: boolean;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { readonly children: ReactNode }) {
  const [session, setSession] = useState<V2Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSession(loadSession());
    setReady(true);
  }, []);

  const login = useCallback((email: string) => {
    const validation = validateCorporateEmail(email);
    if (!validation.ok) {
      return { ok: false as const, message: validation.message };
    }
    const existing = loadSession();
    const next = normalizeSession(
      existing?.email === validation.email
        ? { ...existing, email: validation.email, companyDomain: validation.domain }
        : {
            email: validation.email,
            companyDomain: validation.domain,
            tenantId: tenantIdFromDomain(validation.domain),
            createdAt: new Date().toISOString(),
            onboarding: {},
            integrations: {},
          },
    );
    saveSession(next);
    setSession(next);
    return { ok: true as const };
  }, []);

  const updateSession = useCallback(
    (patch: { onboarding?: Partial<V2OnboardingState>; integrations?: Partial<V2IntegrationsState> }) => {
      setSession((current) => {
        if (!current) {
          return current;
        }
        const next = normalizeSession({
          ...current,
          onboarding: { ...current.onboarding, ...patch.onboarding },
          integrations: { ...current.integrations, ...patch.integrations },
        });
        saveSession(next);
        return next;
      });
    },
    [],
  );

  const logout = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  const isOnboardingComplete = Boolean(session?.onboarding.completedAt);

  const value = useMemo(
    () => ({ session, ready, login, logout, updateSession, isOnboardingComplete }),
    [session, ready, login, logout, updateSession, isOnboardingComplete],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return ctx;
}
