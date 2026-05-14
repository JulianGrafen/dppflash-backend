import { describe, expect, it } from 'vitest';
import {
  getRagTargetFieldKeysForProductType,
  isPassportGtinMissing,
  orderRagTargetKeysPrioritizingGtin,
} from '@/app/domain/rag/ragPassportFieldTargets';

describe('ragPassportFieldTargets', () => {
  it('isPassportGtinMissing is true for empty and PENDING placeholder', () => {
    expect(isPassportGtinMissing({})).toBe(true);
    expect(isPassportGtinMissing({ gtin: '' })).toBe(true);
    expect(isPassportGtinMissing({ gtin: '  ' })).toBe(true);
    expect(isPassportGtinMissing({ gtin: 'PENDING_EXTERNAL_MATCH' })).toBe(true);
    expect(isPassportGtinMissing({ gtin: '5901234123457' })).toBe(false);
  });

  it('orderRagTargetKeysPrioritizingGtin moves gtin to front when missing', () => {
    const base = getRagTargetFieldKeysForProductType('CHEMICAL');
    expect(base.indexOf('gtin')).toBeGreaterThan(0);
    const ordered = orderRagTargetKeysPrioritizingGtin(base, { gtin: 'PENDING_EXTERNAL_MATCH' });
    expect(ordered[0]).toBe('gtin');
  });

  it('orderRagTargetKeysPrioritizingGtin leaves order when gtin present', () => {
    const base = getRagTargetFieldKeysForProductType('CHEMICAL');
    const ordered = orderRagTargetKeysPrioritizingGtin(base, { gtin: '5901234123457' });
    expect(ordered).toEqual([...base]);
  });
});
