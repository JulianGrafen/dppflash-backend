import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildPublicDppPassportUrl,
  DEFAULT_PUBLIC_DPP_URL,
  getPublicDppBaseUrl,
} from '@/app/lib/publicDppUrl';

describe('getPublicDppBaseUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses NEXT_PUBLIC_DPP_URL when set', () => {
    vi.stubEnv('NEXT_PUBLIC_DPP_URL', 'https://dppflash-backend.onrender.com/');
    expect(getPublicDppBaseUrl()).toBe('https://dppflash-backend.onrender.com');
  });

  it('builds passport URLs from configured base', () => {
    vi.stubEnv('NEXT_PUBLIC_DPP_URL', 'https://example.com');
    expect(buildPublicDppPassportUrl('battery-demo-public')).toBe(
      'https://example.com/p/battery-demo-public',
    );
  });

  it('falls back to default public host without env', () => {
    vi.stubEnv('NEXT_PUBLIC_DPP_URL', '');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
    expect(getPublicDppBaseUrl()).toBe(DEFAULT_PUBLIC_DPP_URL);
  });
});
