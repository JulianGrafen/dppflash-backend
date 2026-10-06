import { createVoltstride720PublicPassport, VOLTSTRIDE_720_ID } from '@/app/fixtures/voltstride720PublicPassport';
import type { BatteryDPP } from '@/app/types/dpp-types';
import type { PassportFieldValueState } from '@/app/dashboard/v2/mock/types';

function fieldString(
  fields: Record<string, PassportFieldValueState>,
  key: string,
): string | undefined {
  const v = fields[key]?.value?.trim();
  return v || undefined;
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const n = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Merges editor PassPer fields onto VoltStride baseline for public `/p/voltstride-720` rendering.
 */
export function mapPassportFieldsToBatteryDPP(
  fields: Record<string, PassportFieldValueState>,
  options?: { productName?: string; passId?: string },
): BatteryDPP {
  const baseline = createVoltstride720PublicPassport();
  const id = options?.passId ?? VOLTSTRIDE_720_ID;

  const uniqueId = fieldString(fields, 'battery.uniqueId') ?? baseline.seriennummer;
  const manufacturer = fieldString(fields, 'battery.manufacturer') ?? baseline.hersteller;
  const weight = parseNumber(fieldString(fields, 'battery.weight')) ?? baseline.gewichtKg;
  const energy = parseNumber(fieldString(fields, 'performance.nominalEnergy')) ?? baseline.kapazitaetKWh;
  const co2 = parseNumber(fieldString(fields, 'carbonFootprint.total')) ?? baseline.co2FussabdruckKgGesamt;
  const soh = parseNumber(fieldString(fields, 'durability.stateOfHealth'));

  const overlay: Record<string, string> = {};
  for (const [key, state] of Object.entries(fields)) {
    if (state.value?.trim()) {
      overlay[key] = state.value.trim();
    }
  }

  const productName =
    options?.productName ?? fieldString(fields, 'battery.passportIdentifier') ?? baseline.productName;

  return {
    ...baseline,
    id,
    productName,
    modellname: productName ?? baseline.modellname,
    hersteller: manufacturer ?? baseline.hersteller,
    seriennummer: uniqueId,
    gewichtKg: weight,
    kapazitaetKWh: energy,
    co2FussabdruckKgGesamt: co2,
    carbonFootprint: {
      ...baseline.carbonFootprint,
      totalKg: co2,
      performanceClass:
        fieldString(fields, 'carbonFootprint.performanceClass') ??
        baseline.carbonFootprint?.performanceClass,
    },
    passportFieldOverlay: overlay,
    stateOfHealthPercent: soh,
  };
}
