import {
  getSampleDppPass,
  normalizePass,
  type DppPassField,
  type SampleDppPass,
} from '@/app/_data/sample-dpp.data';
import { mapPassportFieldsToBatteryDPP } from '@/app/domain/battery/mapPassportFieldsToBatteryDPP';
import { VOLTSTRIDE_720_ID } from '@/app/fixtures/voltstride720PublicPassport';
import type { PassportFieldValueState } from '@/app/dashboard/v2/mock/types';
import type { ProductPassport } from '@/app/types/dpp-types';

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function linkActionLabel(field: DppPassField): string {
  const template = field.value.trim();
  if (template.length > 0 && template.length <= 14) {
    return template;
  }
  const lower = template.toLowerCase();
  if (lower.includes('download')) {
    return 'Download';
  }
  if (lower.includes('export')) {
    return 'Export';
  }
  return 'Ansehen';
}

function applyFieldOverlay(pass: SampleDppPass, overlay: Record<string, string>): SampleDppPass {
  const mapField = (field: DppPassField): DppPassField => {
    const key = field.key;
    if (!key) {
      return field;
    }
    const next = overlay[key];
    if (!next) {
      return field;
    }
    if (field.href !== undefined) {
      return {
        ...field,
        href: isHttpUrl(next) ? next.trim() : field.href,
        value: linkActionLabel(field),
      };
    }
    return { ...field, value: next };
  };

  return {
    ...pass,
    publicSection: {
      ...pass.publicSection,
      fields: pass.publicSection.fields.map(mapField),
    },
  };
}

function mergeProductOntoSample(pass: SampleDppPass, product: ProductPassport): SampleDppPass {
  const capacityKwh =
    typeof product.kapazitaetKWh === 'number' && Number.isFinite(product.kapazitaetKWh)
      ? product.kapazitaetKWh
      : undefined;

  const weightKg =
    typeof product.gewichtKg === 'number' && Number.isFinite(product.gewichtKg)
      ? product.gewichtKg
      : undefined;

  const co2 =
    typeof product.co2FussabdruckKgGesamt === 'number' && Number.isFinite(product.co2FussabdruckKgGesamt)
      ? product.co2FussabdruckKgGesamt
      : undefined;

  const soh =
    typeof (product as { stateOfHealthPercent?: number }).stateOfHealthPercent === 'number'
      ? (product as { stateOfHealthPercent?: number }).stateOfHealthPercent
      : undefined;

  const overlay = (product as { passportFieldOverlay?: Record<string, string> }).passportFieldOverlay;

  let next: SampleDppPass = {
    ...pass,
    title:
      (product as { productName?: string }).productName ?? product.modellname ?? pass.title,
    serialNumber: product.seriennummer ?? pass.serialNumber,
    manufacturer: product.hersteller ?? pass.manufacturer,
    capacity: capacityKwh !== undefined ? `${Math.round(capacityKwh * 1000)} Wh` : pass.capacity,
    weight: weightKg !== undefined ? `${weightKg.toLocaleString('de-DE')} kg` : pass.weight,
    carbonFootprint: co2 !== undefined ? `${co2} kg` : pass.carbonFootprint,
    carbonPerformanceClass:
      (product.carbonFootprint as { performanceClass?: SampleDppPass['carbonPerformanceClass'] })
        ?.performanceClass ?? pass.carbonPerformanceClass,
    batteryStatusPercent: soh ?? pass.batteryStatusPercent,
  };

  if (overlay && Object.keys(overlay).length > 0) {
    next = applyFieldOverlay(next, overlay);
  }

  return next;
}

export function resolveSamplePassForProduct(
  slug: string,
  product?: ProductPassport | null,
): SampleDppPass | null {
  const base = getSampleDppPass(slug);
  if (!base) {
    return null;
  }

  let pass = normalizePass({ ...base });
  if (product) {
    pass = mergeProductOntoSample(pass, product);
  }
  return pass;
}

export function resolveSamplePassFromEditorFields(
  fields: Record<string, PassportFieldValueState>,
  options?: { productName?: string; passId?: string },
): SampleDppPass {
  const passId = options?.passId ?? VOLTSTRIDE_720_ID;
  const product = mapPassportFieldsToBatteryDPP(fields, {
    productName: options?.productName,
    passId,
  });
  const pass = resolveSamplePassForProduct(passId, product);
  if (!pass) {
    throw new Error(`No sample pass template for ${passId}`);
  }
  return pass;
}

export function usesDppFlashPassLayout(passId: string): boolean {
  return Boolean(getSampleDppPass(passId));
}
