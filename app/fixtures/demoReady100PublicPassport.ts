import { createVoltstride720PublicPassport } from '@/app/fixtures/voltstride720PublicPassport';
import type { BatteryDPP } from '@/app/types/dpp-types';

/** Stable public pass id for the 100 % readiness demo (manual deploy). */
export const DEMO_READY_100_ID = 'demo-ready-100';

export const DEMO_READY_100_PRODUCT_NAME = 'PowerCell Demo 100 %';

export function createDemoReady100PublicPassport(): BatteryDPP {
  const base = createVoltstride720PublicPassport();
  return {
    ...base,
    id: DEMO_READY_100_ID,
    productName: DEMO_READY_100_PRODUCT_NAME,
    modellname: 'PowerCell Demo Pack · EU Battery Reg.',
    seriennummer: 'DEMO-100-DE-00001',
    passportFieldOverlay: {
      ...(base.passportFieldOverlay ?? {}),
      'battery.passportIdentifier': DEMO_READY_100_ID,
      'battery.uniqueId': 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      'durability.stateOfHealth': '100',
    },
  };
}
