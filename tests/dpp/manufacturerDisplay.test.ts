import { describe, expect, it } from 'vitest';
import type { EsprProductData } from '@/app/types/espr';
import {
  DEFAULT_MANUFACTURER_PHONE,
  manufacturerTextIncludesPhone,
  resolveManufacturerPublication,
} from '@/app/domain/dpp/manufacturerDisplay';

const henkelManufacturer: EsprProductData['manufacturer'] = {
  name: 'Henkel AG & Co. KGaA',
  address: 'Henkelstr. 67, 40589 Düsseldorf',
  country: 'Deutschland',
  phone: '+49 211 797 0',
  email: 'SDSinfo.Adhesive@henkel.com',
};

const henkelPassportBase: EsprProductData = {
  id: 'test-henkel',
  createdAt: new Date().toISOString(),
  language: 'de',
  type: 'BATTERY',
  manufacturer: henkelManufacturer,
  hersteller: 'Henkel AG & Co. KGaA',
  modellname: 'Test',
};

describe('manufacturerDisplay', () => {
  it('detects Henkel central phone in text and formatted lines', () => {
    expect(manufacturerTextIncludesPhone('Tel.: +49 211 797 0')).toBe(true);
    expect(manufacturerTextIncludesPhone('+49 211 797 0')).toBe(true);
    expect(manufacturerTextIncludesPhone('Henkelstr. 67')).toBe(false);
  });

  it('does not duplicate address lines when chunk and structured data overlap', () => {
    const raw = {
      hersteller: [
        'Henkel AG & Co. KGaA',
        'Henkelstr. 67',
        '40589 Düsseldorf',
        'Deutschland',
        'Tel.: +49 211 797 0',
        'SDSinfo.Adhesive@henkel.com',
      ].join('\n'),
      manufacturer: {
        name: 'Henkel AG & Co. KGaA',
        address: 'Henkelstr. 67, 40589 Düsseldorf',
        country: 'Deutschland',
        phone: '+49 211 797 0',
        email: 'SDSinfo.Adhesive@henkel.com',
      },
    };

    const { displayText } = resolveManufacturerPublication(raw, henkelPassportBase);
    const lines = displayText.split('\n').map((line) => line.trim()).filter(Boolean);

    expect(lines.filter((line) => line === 'Henkel AG & Co. KGaA')).toHaveLength(1);
    expect(lines.filter((line) => /211.*797/.test(line))).toHaveLength(1);
    expect(displayText).toContain(DEFAULT_MANUFACTURER_PHONE);
  });

  it('coalesces split phone suffix and normalizes to canonical Henkel number', () => {
    const raw = {
      hersteller: [
        'Henkel AG & Co. KGaA',
        'Henkelstr. 67',
        '40589 Düsseldorf',
        'Deutschland',
        'Tel.: +49 211 797',
        '0',
      ].join('\n'),
    };

    const { displayText } = resolveManufacturerPublication(raw, {
      ...henkelPassportBase,
      manufacturer: { name: 'Henkel AG & Co. KGaA' },
    });

    expect(displayText).toContain(DEFAULT_MANUFACTURER_PHONE);
    expect(displayText.split('\n').filter((line) => /211.*797/.test(line))).toHaveLength(1);
  });

  it('inserts default phone only when no number is present', () => {
    const raw = {
      hersteller: [
        'Henkel AG & Co. KGaA',
        'Henkelstr. 67',
        '40589 Düsseldorf',
        'Deutschland',
      ].join('\n'),
    };

    const { displayText } = resolveManufacturerPublication(raw, {
      ...henkelPassportBase,
      manufacturer: { name: 'Henkel AG & Co. KGaA', address: 'Henkelstr. 67, 40589 Düsseldorf', country: 'Deutschland' },
    });

    expect(displayText).toContain(DEFAULT_MANUFACTURER_PHONE);
    expect(displayText.split('\n').filter((line) => /211.*797/.test(line))).toHaveLength(1);
  });
});
