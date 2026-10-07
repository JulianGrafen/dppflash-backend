import { describe, expect, it } from 'vitest';
import { mapPassportFieldsToBatteryDPP } from '@/app/domain/battery/mapPassportFieldsToBatteryDPP';
import { initializePassportFieldsFromCatalog } from '@/app/dashboard/v2/mock/passportFields';

describe('mapPassportFieldsToBatteryDPP', () => {
  it('maps key identity and performance fields onto BatteryDPP', () => {
    const fields = initializePassportFieldsFromCatalog();
    fields['battery.manufacturer'] = { ...fields['battery.manufacturer'], value: 'Acme GmbH' };
    fields['performance.nominalEnergy'] = { ...fields['performance.nominalEnergy'], value: '0.72' };
    fields['durability.stateOfHealth'] = { ...fields['durability.stateOfHealth'], value: '82' };

    const product = mapPassportFieldsToBatteryDPP(fields, { productName: 'Test Pack' });

    expect(product.hersteller).toBe('Acme GmbH');
    expect(product.kapazitaetKWh).toBe(0.72);
    expect(product.stateOfHealthPercent).toBe(82);
    expect(product.id).toBe('voltstride-720');
  });
});
