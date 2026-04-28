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

export interface DppProductPassport {
  readonly schemaVersion: typeof DPP_SCHEMA_VERSION;
  readonly declaredProductType?: string;
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

export function validateDppProductPassport(data: DppProductPassport): DppValidationResult {
  const issues: DppValidationIssue[] = [];

  if (data.schemaVersion !== DPP_SCHEMA_VERSION) {
    issues.push({ field: 'schemaVersion', message: `Schema version must be ${DPP_SCHEMA_VERSION}.` });
  }

  if (!isNonEmptyString(data.upi)) {
    issues.push({ field: 'upi', message: 'UPI is required.' });
  }

  if (!GTIN_PATTERN.test(data.gtin) || !hasValidGtinChecksum(data.gtin)) {
    issues.push({ field: 'gtin', message: 'GTIN must be 8, 12, 13 or 14 digits with a valid checksum.' });
  }

  issues.push(...validateMaterialList('materialComposition', data.materialComposition));
  issues.push(...validateMaterialList('recycledContent', data.recycledContent));

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
