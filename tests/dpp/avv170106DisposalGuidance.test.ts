import { describe, expect, it } from 'vitest';
import {
  isAvvCode170106,
  shouldShowAvv170106DisposalDetail,
} from '@/app/domain/dpp/waste/avv170106DisposalGuidance';

describe('avv170106DisposalGuidance', () => {
  it('matches common AVV 170106 formats', () => {
    expect(isAvvCode170106('170106')).toBe(true);
    expect(isAvvCode170106('17 01 06')).toBe(true);
    expect(isAvvCode170106('17 01 06*')).toBe(true);
    expect(isAvvCode170106('17-01-06')).toBe(true);
  });

  it('rejects other waste codes', () => {
    expect(isAvvCode170106('08 04 09*')).toBe(false);
    expect(isAvvCode170106(undefined)).toBe(false);
    expect(isAvvCode170106('')).toBe(false);
  });

  it('shows detail card when wasteCode or ewcCode matches', () => {
    expect(shouldShowAvv170106DisposalDetail('170106', undefined)).toBe(true);
    expect(shouldShowAvv170106DisposalDetail(undefined, '17 01 06*')).toBe(true);
    expect(shouldShowAvv170106DisposalDetail('08 04 09*', undefined)).toBe(false);
  });
});
