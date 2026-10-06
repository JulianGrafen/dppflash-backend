'use client';

import { PASS_LOCALES } from '@/lib/pass-locale';
import { cn } from 'cn';

import { usePassLocale } from '@/components/dpp/pass-locale-context';

export function PassLangChips() {
  const { locale, setLocale, ui } = usePassLocale();

  return (
    <div
      className="flex shrink-0 gap-0.5 rounded-full border border-white/20 bg-black/20 p-0.5"
      role="group"
      aria-label={ui.language}
    >
      {PASS_LOCALES.map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => setLocale(lang)}
          className={cn(
            'rounded-full px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-wide transition-colors sm:text-[0.6rem]',
            locale === lang
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-white/85 hover:bg-white/15',
          )}
          aria-pressed={locale === lang}
        >
          {lang}
        </button>
      ))}
    </div>
  );
}
