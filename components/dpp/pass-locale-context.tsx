'use client';

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { SampleDppPass } from '@/app/_data/sample-dpp.data';
import { getPassUiStrings, localizeSamplePass } from '@/lib/localize-sample-pass';
import type { PassLocale, PassUiStrings } from '@/lib/pass-locale';

type PassLocaleContextValue = {
  locale: PassLocale;
  setLocale: (locale: PassLocale) => void;
  pass: SampleDppPass;
  ui: PassUiStrings;
};

const PassLocaleContext = createContext<PassLocaleContextValue | null>(null);

export function PassLocaleProvider({
  pass,
  children,
}: {
  pass: SampleDppPass;
  children: ReactNode;
}) {
  const [locale, setLocale] = useState<PassLocale>('de');

  const localizedPass = useMemo(
    () => localizeSamplePass(pass, locale),
    [pass, locale],
  );
  const ui = useMemo(() => getPassUiStrings(pass.slug, locale), [pass.slug, locale]);

  const value = useMemo(
    () => ({ locale, setLocale, pass: localizedPass, ui }),
    [locale, localizedPass, ui],
  );

  return (
    <PassLocaleContext.Provider value={value}>{children}</PassLocaleContext.Provider>
  );
}

export function usePassLocale() {
  const ctx = useContext(PassLocaleContext);
  if (!ctx) {
    throw new Error('usePassLocale must be used within PassLocaleProvider');
  }
  return ctx;
}
