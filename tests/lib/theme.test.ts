import { describe, expect, it } from 'vitest';
import { resolveInitialTheme, type Theme } from '@/lib/theme';

describe('theme', () => {
  it('resolveInitialTheme prefers stored value', () => {
    const storage = new Map<string, string>();
    const localStorage = {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, v),
    };
    vi.stubGlobal('localStorage', localStorage);
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: false }),
    });

    storage.set('dppflash_theme', 'dark');
    expect(resolveInitialTheme()).toBe('dark' satisfies Theme);

    vi.unstubAllGlobals();
  });
});
