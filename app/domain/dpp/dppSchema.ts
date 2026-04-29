export const DPP_SCHEMA_VERSION = 'ESPR_DPP_V1' as const;

export interface MaterialComponent {
  readonly material: string;
  readonly percentage: number;
}

export interface RecycledContentEntry {
  readonly material: string;
  readonly percentage: number;
}

export interface CarbonFootprint {
  readonly valueKgCo2e: number;
  readonly lifecycleStage?: string;
  readonly calculationMethod?: string;
}

export interface SubstanceOfConcern {
  readonly name: string;
  readonly casNumber?: string;
  readonly concentrationPercent?: number;
  readonly hazardClass?: string;
}

export interface ManufacturerInfo {
  readonly name: string;
  readonly address?: string;
  readonly country?: string;
}

export interface SupplyChainEntry {
  readonly level: string;
  readonly supplierName?: string;
  readonly supplierId?: string;
  readonly supplierCountry?: string;
  readonly processName?: string;
  readonly processDescription?: string;
}

export interface CareRepairDurability {
  readonly careInstructions?: string;
  readonly repairInstructions?: string;
  readonly durabilityGuidance?: string;
}

export interface ChemicalCompositionEntry {
  readonly substance: string;
  readonly casNumber?: string;
  readonly concentrationPercent?: number;
  readonly function?: string;
}

export interface EnvironmentalImpactSummary {
  readonly waterFootprintLiters?: number;
  readonly impactNotes?: string;
}

export interface DppProductPassport {
  readonly schemaVersion: typeof DPP_SCHEMA_VERSION;
  readonly declaredProductType?: string;
  readonly productName: string;
  readonly wasteCode?: string;
  readonly manufacturer?: ManufacturerInfo;
  readonly countryOfOrigin?: string;
  readonly countryOfManufacturing?: string;
  readonly supplierAndProcessInformation?: readonly SupplyChainEntry[];
  readonly careRepairDurability?: CareRepairDurability;
  readonly endOfLifeInstructions?: string;
  readonly chemicalComposition?: readonly ChemicalCompositionEntry[];
  readonly environmentalImpact?: EnvironmentalImpactSummary;
  readonly upi: string;
  readonly gtin: string;
  readonly materialComposition: readonly MaterialComponent[];
  readonly recycledContent: readonly RecycledContentEntry[];
  readonly carbonFootprint: CarbonFootprint;
  readonly substancesOfConcern: readonly SubstanceOfConcern[];
}

export interface DppValidationIssue {
  readonly field: keyof DppProductPassport | string;
  readonly message: string;
}

export interface DppValidationResult {
  readonly isValid: boolean;
  readonly issues: readonly DppValidationIssue[];
}

export class DppValidationError extends Error {
  constructor(readonly issues: readonly DppValidationIssue[]) {
    super(`DPP validation failed: ${issues.map((issue) => issue.field).join(', ')}`);
    this.name = 'DppValidationError';
  }
}

const GTIN_PATTERN = /^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPercentage(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
}

function hasValidGtinChecksum(gtin: string): boolean {
  const digits = gtin.split('').map(Number);
  const checkDigit = digits.pop();

  if (checkDigit === undefined) {
    return false;
  }

  const sum = digits
    .reverse()
    .reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  const expectedCheckDigit = (10 - (sum % 10)) % 10;

  return checkDigit === expectedCheckDigit;
}

function validateMaterialList(
  field: 'materialComposition' | 'recycledContent',
  entries: readonly MaterialComponent[] | readonly RecycledContentEntry[],
): DppValidationIssue[] {
  if (!Array.isArray(entries) || entries.length === 0) {
    return [{ field, message: 'At least one material entry is required.' }];
  }

  return entries.flatMap((entry, index) => {
    const issues: DppValidationIssue[] = [];

    if (!isNonEmptyString(entry.material)) {
      issues.push({ field: `${field}[${index}].material`, message: 'Material name is required.' });
    }

    if (!isPercentage(entry.percentage)) {
      issues.push({
        field: `${field}[${index}].percentage`,
        message: 'Percentage must be between 0 and 100.',
      });
    }

    return issues;
  });
}

function validateOptionalSupplyChainEntries(
  entries: readonly SupplyChainEntry[] | undefined,
): DppValidationIssue[] {
  if (entries === undefined) {
    return [];
  }

  if (!Array.isArray(entries)) {
    return [{
      field: 'supplierAndProcessInformation',
      message: 'Supplier and process information must be an array.',
    }];
  }

  return entries.flatMap((entry, index) => {
    const issues: DppValidationIssue[] = [];

    if (!isNonEmptyString(entry.level)) {
      issues.push({
        field: `supplierAndProcessInformation[${index}].level`,
        message: 'Supply chain level is required when supplier/process information is present.',
      });
    }

    return issues;
  });
}

function validateOptionalChemicalComposition(
  entries: readonly ChemicalCompositionEntry[] | undefined,
): DppValidationIssue[] {
  if (entries === undefined) {
    return [];
  }

  if (!Array.isArray(entries)) {
    return [{
      field: 'chemicalComposition',
      message: 'Chemical composition must be an array.',
    }];
  }

  return entries.flatMap((entry, index) => {
    const issues: DppValidationIssue[] = [];

    if (!isNonEmptyString(entry.substance)) {
      issues.push({
        field: `chemicalComposition[${index}].substance`,
        message: 'Chemical substance name is required.',
      });
    }

    if (
      entry.concentrationPercent !== undefined
      && !isPercentage(entry.concentrationPercent)
    ) {
      issues.push({
        field: `chemicalComposition[${index}].concentrationPercent`,
        message: 'Chemical composition percentage must be between 0 and 100.',
      });
    }

    return issues;
  });
}

export function validateDppProductPassport(data: DppProductPassport): DppValidationResult {
  const issues: DppValidationIssue[] = [];

  if (data.schemaVersion !== DPP_SCHEMA_VERSION) {
    issues.push({ field: 'schemaVersion', message: `Schema version must be ${DPP_SCHEMA_VERSION}.` });
  }

  if (!isNonEmptyString(data.upi)) {
    issues.push({ field: 'upi', message: 'UPI is required.' });
  }

  if (!isNonEmptyString(data.productName)) {
    issues.push({ field: 'productName', message: 'Product name is required.' });
  }

  if (data.wasteCode !== undefined && !isNonEmptyString(data.wasteCode)) {
    issues.push({ field: 'wasteCode', message: 'Waste code must not be empty when provided.' });
  }

  if (!GTIN_PATTERN.test(data.gtin) || !hasValidGtinChecksum(data.gtin)) {
    issues.push({ field: 'gtin', message: 'GTIN must be 8, 12, 13 or 14 digits with a valid checksum.' });
  }

  issues.push(...validateMaterialList('materialComposition', data.materialComposition));
  issues.push(...validateMaterialList('recycledContent', data.recycledContent));
  issues.push(...validateOptionalSupplyChainEntries(data.supplierAndProcessInformation));
  issues.push(...validateOptionalChemicalComposition(data.chemicalComposition));

  if (data.manufacturer && !isNonEmptyString(data.manufacturer.name)) {
    issues.push({ field: 'manufacturer.name', message: 'Manufacturer name must not be empty when manufacturer data is present.' });
  }

  if (
    data.environmentalImpact?.waterFootprintLiters !== undefined
    && (
      typeof data.environmentalImpact.waterFootprintLiters !== 'number'
      || !Number.isFinite(data.environmentalImpact.waterFootprintLiters)
      || data.environmentalImpact.waterFootprintLiters < 0
    )
  ) {
    issues.push({
      field: 'environmentalImpact.waterFootprintLiters',
      message: 'Water footprint must be a non-negative numeric value.',
    });
  }

  if (
    typeof data.carbonFootprint?.valueKgCo2e !== 'number'
    || !Number.isFinite(data.carbonFootprint.valueKgCo2e)
    || data.carbonFootprint.valueKgCo2e < 0
  ) {
    issues.push({
      field: 'carbonFootprint.valueKgCo2e',
      message: 'Carbon footprint must be a non-negative kg CO2e value.',
    });
  }

  if (!Array.isArray(data.substancesOfConcern)) {
    issues.push({ field: 'substancesOfConcern', message: 'Substances of concern must be an array.' });
  } else {
    data.substancesOfConcern.forEach((substance, index) => {
      if (!isNonEmptyString(substance.name)) {
        issues.push({
          field: `substancesOfConcern[${index}].name`,
          message: 'Substance name is required.',
        });
      }

      if (
        substance.concentrationPercent !== undefined
        && !isPercentage(substance.concentrationPercent)
      ) {
        issues.push({
          field: `substancesOfConcern[${index}].concentrationPercent`,
          message: 'Concentration must be between 0 and 100 percent.',
        });
      }
    });
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}
