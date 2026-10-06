import {
  createVoltstride720PublicPassport,
  VOLTSTRIDE_720_ID,
} from '@/app/fixtures/voltstride720PublicPassport';

/** Initial PassPer field values derived from VoltStride public fixture. */
export function buildVoltstridePassportFieldSeed(): Record<string, string> {
  const product = createVoltstride720PublicPassport();
  const overlay = (product.passportFieldOverlay ?? {}) as Record<string, string>;

  const seed: Record<string, string> = { ...overlay };

  if (product.productName) {
    seed['battery.passportIdentifier'] = seed['battery.passportIdentifier'] ?? VOLTSTRIDE_720_ID;
  }
  if (product.seriennummer) {
    seed['battery.uniqueId'] = seed['battery.uniqueId'] ?? product.seriennummer;
  }
  if (product.hersteller) {
    seed['battery.manufacturer'] = product.hersteller;
  }
  if (product.gewichtKg !== undefined) {
    seed['battery.weight'] = String(product.gewichtKg);
  }
  if (product.kapazitaetKWh !== undefined) {
    seed['performance.nominalEnergy'] = String(product.kapazitaetKWh);
  }
  if (product.co2FussabdruckKgGesamt !== undefined) {
    seed['carbonFootprint.total'] = String(product.co2FussabdruckKgGesamt);
  }
  if (product.carbonFootprint?.performanceClass) {
    seed['carbonFootprint.performanceClass'] = product.carbonFootprint.performanceClass;
  }

  return seed;
}
