export enum DppSchemaVersion {
  EsprV1 = 'ESPR_DPP_V1',
}

export enum CarbonFootprintUnit {
  KgCo2Equivalent = 'kg CO2 eq',
}

export interface Identification {
  readonly upi: string;
  readonly gtin?: string;
  readonly batchNumber: string;
  readonly taricCode: string;
}

export interface Manufacturer {
  readonly name: string;
  readonly address: string;
  readonly vatId: string;
}

export interface Material {
  readonly name: string;
  readonly casNumber?: string;
  readonly percentage: number;
  readonly isRecycled: boolean;
}

export type Composition = readonly Material[];

export interface Substance {
  readonly name: string;
  readonly casNumber: string;
  readonly concentration: number;
  readonly hazardStatement: string;
}

export type SubstancesOfConcern = readonly Substance[];

export interface EnvironmentalImpact {
  readonly carbonFootprint: number;
  readonly waterFootprint?: number;
}

export interface Circularity {
  readonly shelfLifeInMonths: number;
  readonly disposalInstructions: string;
}

export interface DigitalProductPassport {
  readonly schemaVersion: DppSchemaVersion.EsprV1;
  readonly identification: Identification;
  readonly manufacturer: Manufacturer;
  readonly composition: Composition;
  readonly substancesOfConcern: SubstancesOfConcern;
  readonly environmentalImpact: EnvironmentalImpact;
  readonly circularity: Circularity;
}

export interface DppSchemaValidationResult {
  readonly success: boolean;
  readonly data?: DigitalProductPassport;
  readonly errors: readonly string[];
}

export class DppModelValidationError extends Error {
  constructor(readonly errors: readonly string[]) {
    super(`Invalid Digital Product Passport: ${errors.join('; ')}`);
    this.name = 'DppModelValidationError';
  }
}

const GTIN_PATTERN = /^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/;
const TARIC_PATTERN = /^\d{8,10}$/;
const CAS_NUMBER_PATTERN = /^\d{2,7}-\d{2}-\d$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readRecord(value: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  const nestedValue = value[key];
  return isRecord(nestedValue) ? nestedValue : undefined;
}

function readArray(value: Record<string, unknown>, key: string): readonly unknown[] | undefined {
  const nestedValue = value[key];
  return Array.isArray(nestedValue) ? nestedValue : undefined;
}

function readRequiredString(
  source: Record<string, unknown>,
  key: string,
  path: string,
  errors: string[],
): string {
  const value = source[key];

  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  errors.push(`${path} must be a non-empty string.`);
  return '';
}

function readOptionalString(
  source: Record<string, unknown>,
  key: string,
  path: string,
  errors: string[],
): string | undefined {
  const value = source[key];

  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  errors.push(`${path} must be a string when provided.`);
  return undefined;
}

function readRequiredNumber(
  source: Record<string, unknown>,
  key: string,
  path: string,
  errors: string[],
): number {
  const value = source[key];

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  errors.push(`${path} must be a finite number.`);
  return 0;
}

function readOptionalNumber(
  source: Record<string, unknown>,
  key: string,
  path: string,
  errors: string[],
): number | undefined {
  const value = source[key];

  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  errors.push(`${path} must be a finite number when provided.`);
  return undefined;
}

function readRequiredBoolean(
  source: Record<string, unknown>,
  key: string,
  path: string,
  errors: string[],
): boolean {
  const value = source[key];

  if (typeof value === 'boolean') {
    return value;
  }

  errors.push(`${path} must be a boolean.`);
  return false;
}

function validatePercentage(value: number, path: string, errors: string[]): void {
  if (value < 0 || value > 100) {
    errors.push(`${path} must be between 0 and 100.`);
  }
}

function validateNonNegative(value: number, path: string, errors: string[]): void {
  if (value < 0) {
    errors.push(`${path} must not be negative.`);
  }
}

function validateCasNumber(value: string | undefined, path: string, errors: string[]): void {
  if (value && !CAS_NUMBER_PATTERN.test(value)) {
    errors.push(`${path} must use a valid CAS Registry Number format.`);
  }
}

function parseIdentification(source: Record<string, unknown>, errors: string[]): Identification {
  const upi = readRequiredString(source, 'upi', 'identification.upi', errors);
  const gtin = readOptionalString(source, 'gtin', 'identification.gtin', errors);
  const batchNumber = readRequiredString(source, 'batchNumber', 'identification.batchNumber', errors);
  const taricCode = readRequiredString(source, 'taricCode', 'identification.taricCode', errors);

  if (gtin && !GTIN_PATTERN.test(gtin)) {
    errors.push('identification.gtin must be a GTIN-8, GTIN-12, GTIN-13 or GTIN-14.');
  }

  if (taricCode && !TARIC_PATTERN.test(taricCode)) {
    errors.push('identification.taricCode must contain 8 to 10 digits.');
  }

  return { upi, gtin, batchNumber, taricCode };
}

function parseManufacturer(source: Record<string, unknown>, errors: string[]): Manufacturer {
  return {
    name: readRequiredString(source, 'name', 'manufacturer.name', errors),
    address: readRequiredString(source, 'address', 'manufacturer.address', errors),
    vatId: readRequiredString(source, 'vatId', 'manufacturer.vatId', errors),
  };
}

function parseMaterial(source: Record<string, unknown>, index: number, errors: string[]): Material {
  const path = `composition[${index}]`;
  const name = readRequiredString(source, 'name', `${path}.name`, errors);
  const casNumber = readOptionalString(source, 'casNumber', `${path}.casNumber`, errors);
  const percentage = readRequiredNumber(source, 'percentage', `${path}.percentage`, errors);
  const isRecycled = readRequiredBoolean(source, 'isRecycled', `${path}.isRecycled`, errors);

  validateCasNumber(casNumber, `${path}.casNumber`, errors);
  validatePercentage(percentage, `${path}.percentage`, errors);

  return { name, casNumber, percentage, isRecycled };
}

function parseComposition(entries: readonly unknown[] | undefined, errors: string[]): Composition {
  if (!entries || entries.length === 0) {
    errors.push('composition must contain at least one material.');
    return [];
  }

  return entries.map((entry, index) => {
    if (!isRecord(entry)) {
      errors.push(`composition[${index}] must be an object.`);
      return { name: '', percentage: 0, isRecycled: false };
    }

    return parseMaterial(entry, index, errors);
  });
}

function parseSubstance(source: Record<string, unknown>, index: number, errors: string[]): Substance {
  const path = `substancesOfConcern[${index}]`;
  const name = readRequiredString(source, 'name', `${path}.name`, errors);
  const casNumber = readRequiredString(source, 'casNumber', `${path}.casNumber`, errors);
  const concentration = readRequiredNumber(source, 'concentration', `${path}.concentration`, errors);
  const hazardStatement = readRequiredString(source, 'hazardStatement', `${path}.hazardStatement`, errors);

  validateCasNumber(casNumber, `${path}.casNumber`, errors);
  validatePercentage(concentration, `${path}.concentration`, errors);

  return { name, casNumber, concentration, hazardStatement };
}

function parseSubstancesOfConcern(
  entries: readonly unknown[] | undefined,
  errors: string[],
): SubstancesOfConcern {
  if (!entries) {
    errors.push('substancesOfConcern must be an array.');
    return [];
  }

  return entries.map((entry, index) => {
    if (!isRecord(entry)) {
      errors.push(`substancesOfConcern[${index}] must be an object.`);
      return { name: '', casNumber: '', concentration: 0, hazardStatement: '' };
    }

    return parseSubstance(entry, index, errors);
  });
}

function parseEnvironmentalImpact(
  source: Record<string, unknown>,
  errors: string[],
): EnvironmentalImpact {
  const carbonFootprint = readRequiredNumber(
    source,
    'carbonFootprint',
    'environmentalImpact.carbonFootprint',
    errors,
  );
  const waterFootprint = readOptionalNumber(
    source,
    'waterFootprint',
    'environmentalImpact.waterFootprint',
    errors,
  );

  validateNonNegative(carbonFootprint, 'environmentalImpact.carbonFootprint', errors);

  if (waterFootprint !== undefined) {
    validateNonNegative(waterFootprint, 'environmentalImpact.waterFootprint', errors);
  }

  return { carbonFootprint, waterFootprint };
}

function parseCircularity(source: Record<string, unknown>, errors: string[]): Circularity {
  const shelfLifeInMonths = readRequiredNumber(
    source,
    'shelfLifeInMonths',
    'circularity.shelfLifeInMonths',
    errors,
  );

  validateNonNegative(shelfLifeInMonths, 'circularity.shelfLifeInMonths', errors);

  return {
    shelfLifeInMonths,
    disposalInstructions: readRequiredString(
      source,
      'disposalInstructions',
      'circularity.disposalInstructions',
      errors,
    ),
  };
}

function parseDigitalProductPassport(input: unknown): DppSchemaValidationResult {
  const errors: string[] = [];

  if (!isRecord(input)) {
    return {
      success: false,
      errors: ['Digital Product Passport payload must be an object.'],
    };
  }

  const schemaVersion = input.schemaVersion;

  if (schemaVersion !== DppSchemaVersion.EsprV1) {
    errors.push(`schemaVersion must be ${DppSchemaVersion.EsprV1}.`);
  }

  const identificationSource = readRecord(input, 'identification');
  const manufacturerSource = readRecord(input, 'manufacturer');
  const environmentalImpactSource = readRecord(input, 'environmentalImpact');
  const circularitySource = readRecord(input, 'circularity');

  if (!identificationSource) errors.push('identification must be an object.');
  if (!manufacturerSource) errors.push('manufacturer must be an object.');
  if (!environmentalImpactSource) errors.push('environmentalImpact must be an object.');
  if (!circularitySource) errors.push('circularity must be an object.');

  const data: DigitalProductPassport = {
    schemaVersion: DppSchemaVersion.EsprV1,
    identification: identificationSource
      ? parseIdentification(identificationSource, errors)
      : { upi: '', batchNumber: '', taricCode: '' },
    manufacturer: manufacturerSource
      ? parseManufacturer(manufacturerSource, errors)
      : { name: '', address: '', vatId: '' },
    composition: parseComposition(readArray(input, 'composition'), errors),
    substancesOfConcern: parseSubstancesOfConcern(readArray(input, 'substancesOfConcern'), errors),
    environmentalImpact: environmentalImpactSource
      ? parseEnvironmentalImpact(environmentalImpactSource, errors)
      : { carbonFootprint: 0 },
    circularity: circularitySource
      ? parseCircularity(circularitySource, errors)
      : { shelfLifeInMonths: 0, disposalInstructions: '' },
  };

  return {
    success: errors.length === 0,
    data: errors.length === 0 ? data : undefined,
    errors,
  };
}

export const dppSchema = {
  safeParse: parseDigitalProductPassport,
  parse(input: unknown): DigitalProductPassport {
    const result = parseDigitalProductPassport(input);

    if (!result.success || !result.data) {
      throw new DppModelValidationError(result.errors);
    }

    return result.data;
  },
} as const;

export function createDigitalProductPassport(input: unknown): DigitalProductPassport {
  return dppSchema.parse(input);
}
