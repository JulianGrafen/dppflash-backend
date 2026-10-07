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
import { cn } from 'cn';

export type EditorContentLocale = 'de' | 'en';

const STORAGE_KEY = 'dppflash_v2_editor_content_locale';

type EditorContentLocaleContextValue = {
  locale: EditorContentLocale;
  setLocale: (locale: EditorContentLocale) => void;
};

const EditorContentLocaleContext = createContext<EditorContentLocaleContextValue | null>(null);

export function EditorContentLocaleProvider({ children }: { readonly children: ReactNode }) {
  const [locale, setLocaleState] = useState<EditorContentLocale>('de');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'de' || stored === 'en') {
        setLocaleState(stored);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const setLocale = useCallback((next: EditorContentLocale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return (
    <EditorContentLocaleContext.Provider value={value}>{children}</EditorContentLocaleContext.Provider>
  );
}

export function useEditorContentLocale(): EditorContentLocaleContextValue {
  const ctx = useContext(EditorContentLocaleContext);
  if (!ctx) {
    throw new Error('useEditorContentLocale must be used within EditorContentLocaleProvider');
  }
  return ctx;
}

export function EditorLocaleSwitcher({ className }: { readonly className?: string }) {
  const { locale, setLocale } = useEditorContentLocale();

  return (
    <div
      className={cn(
        'inline-flex rounded-lg border border-border bg-muted/50 p-0.5',
        className,
      )}
      role="group"
      aria-label="Bearbeitungssprache"
    >
      {(['de', 'en'] as const).map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => setLocale(lang)}
          className={cn(
            'min-w-[2.75rem] cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors',
            locale === lang
              ? 'bg-card text-foreground shadow-sm ring-1 ring-border'
              : 'text-muted-foreground hover:text-foreground',
          )}
          aria-pressed={locale === lang}
        >
          {lang}
        </button>
      ))}
    </div>
  );
}
