import { describe, expect, it } from 'vitest';
import { validateCorporateEmail } from '@/app/dashboard/v2/lib/corporateEmail';

describe('validateCorporateEmail', () => {
  it('accepts corporate domains', () => {
    const result = validateCorporateEmail('user@acme.de');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.domain).toBe('acme.de');
    }
  });

  it('rejects gmail', () => {
    const result = validateCorporateEmail('user@gmail.com');
    expect(result.ok).toBe(false);
  });

  it('rejects proton', () => {
    const result = validateCorporateEmail('user@proton.me');
    expect(result.ok).toBe(false);
  });
});
