/**
 * Utilities: Field Detection & Transformation
 * Advanced field detection, normalization, and categorization
 */

/**
 * Field categories for organization in UI
 */
export enum FieldCategory {
  GENERAL_INFO = 'Allgemeine Informationen',
  SPECIFICATIONS = 'Spezifikationen',
  ESPR_REQUIREMENTS = 'ESPR-Anforderungen',
  SUSTAINABILITY = 'Nachhaltigkeit & Recycling',
  HAZARDS = 'Gefahrenstoffe & Warnhinweise',
  OTHER = 'Weitere Daten',
}

/**
 * Categorizes a field key based on keywords
 */
export function categorizeField(fieldKey: string): FieldCategory {
  const key = fieldKey.toLowerCase();
  
  // General info fields
  if (['hersteller', 'modellname', 'createdAt', 'language', 'produktionsdatum'].includes(key)) {
    return FieldCategory.GENERAL_INFO;
  }
  
  // ESPR requirements (CO2, durability, repairability, hazards)
  if (
    key.includes('co2') || 
    key.includes('fussabdruck') ||
    key.includes('lebensdauer') ||
    key.includes('reparierbarkeit') ||
    key.includes('ersatzteile') ||
    key.includes('entsorgung')
  ) {
    return FieldCategory.ESPR_REQUIREMENTS;
  }
  
  // Sustainability & Recycling
  if (
    key.includes('recycling') ||
    key.includes('nachhaltig') ||
    key.includes('umwelt') ||
    key.includes('abbaubar') ||
    key.includes('rohstoff')
  ) {
    return FieldCategory.SUSTAINABILITY;
  }
  
  // Hazards & Warnings
  if (
    key.includes('gefahrstoff') ||
    key.includes('gefahren') ||
    key.includes('warnung') ||
    key.includes('hazard') ||
    key.includes('voc') ||
    key.includes('quecksilber')
  ) {
    return FieldCategory.HAZARDS;
  }
  
  // Default: Specifications
  return FieldCategory.SPECIFICATIONS;
}

/**
 * Normalization of field values for consistent display
 */
export function normalizeFieldValue(value: any, fieldKey?: string): any {
  if (value === null || value === undefined) return undefined;
  
  // Handle percentages
  if (typeof value === 'number' && fieldKey?.includes('anteil')) {
    return `${value}%`;
  }
  
  // Handle energy values
  if (typeof value === 'number' && fieldKey?.includes('kwh')) {
    return `${value} kWh`;
  }
  
  // Handle weights
  if (typeof value === 'number' && fieldKey?.includes('gewicht')) {
    return `${value} kg`;
  }
  
  // Handle temperatures
  if (typeof value === 'number' && fieldKey?.includes('temperatur')) {
    return `${value}°C`;
  }
  
  // Handle decibels
  if (typeof value === 'number' && fieldKey?.includes('geraeusch')) {
    return `${value} dB`;
  }
  
  return value;
}

/**
 * Identifies critical fields that must be present for compliance
 */
export function getCriticalFieldsForType(productType: string): string[] {
  const criticalFields: Record<string, string[]> = {
    BATTERY: [
      'hersteller',
      'modellname',
      'kapazitaetKWh',
      'batterietyp',
      'co2FussabdruckKgProKwh',
      'erwarteteLebensdauerLadezyklen',
    ],
    TEXTILE: [
      'hersteller',
      'modellname',
      'materialZusammensetzung',
    ],
    ELECTRONICS: [
      'hersteller',
      'modellname',
      'stromverbrauch',
      'energieeffizienzklasse',
    ],
    FURNITURE: [
      'hersteller',
      'modellname',
      'material',
    ],
    PAINT: [
      'hersteller',
      'modellname',
      'zusammensetzung',
    ],
    LUBRICANT: [
      'hersteller',
      'modellname',
      'zusammensetzung',
    ],
    TYRE: [
      'hersteller',
      'modellname',
      'reifengross',
    ],
    PLASTIC: [
      'hersteller',
      'modellname',
      'kunststoffart',
    ],
    WASHER: [
      'hersteller',
      'modellname',
      'energie_kwh',
    ],
    REFRIGERATOR: [
      'hersteller',
      'modellname',
      'energieverbrauch_kwh',
    ],
    LIGHTING: [
      'hersteller',
      'modellname',
      'leuchtenart',
    ],
    CHEMICAL: [
      'hersteller',
      'modellname',
      'zusammensetzung',
    ],
  };
  
  return criticalFields[productType] || [
    'hersteller',
    'modellname',
  ];
}

/**
 * Validates if product has all critical fields
 * Returns missing fields
 */
export function validateComplianceFields(
  product: Record<string, any>,
  productType: string
): string[] {
  const critical = getCriticalFieldsForType(productType);
  const missing: string[] = [];
  
  for (const field of critical) {
    const value = product[field];
    if (value === null || value === undefined || value === '' || value.length === 0) {
      missing.push(field);
    }
  }
  
  return missing;
}

/**
 * Checks if field contains hazard information
 */
export function isHazardField(fieldKey: string): boolean {
  const hazardKeywords = [
    'gefahrstoff',
    'gefahren',
    'warnung',
    'hazard',
    'giftig',
    'toxic',
    'brand',
    'fire',
  ];
  
  return hazardKeywords.some(keyword =>
    fieldKey.toLowerCase().includes(keyword)
  );
}

/**
 * Groups fields by category
 * Enhanced version that handles all product types
 */
export function groupFieldsByTypeAndCategory(
  product: Record<string, any>
): Record<FieldCategory, Array<[string, any]>> {
  const grouped: Record<FieldCategory, Array<[string, any]>> = {
    [FieldCategory.GENERAL_INFO]: [],
    [FieldCategory.SPECIFICATIONS]: [],
    [FieldCategory.ESPR_REQUIREMENTS]: [],
    [FieldCategory.SUSTAINABILITY]: [],
    [FieldCategory.HAZARDS]: [],
    [FieldCategory.OTHER]: [],
  };
  
  for (const [key, value] of Object.entries(product)) {
    // Skip internal fields
    if (['__proto__', '_id', '_type', 'id', 'type'].includes(key)) continue;
    if (value === null || value === undefined || value === '') continue;
    
    const category = categorizeField(key);
    grouped[category].push([key, value]);
  }
  
  return grouped;
}

/**
 * Generates compliance warnings based on missing fields
 */
export function generateComplianceWarnings(
  product: Record<string, any>,
  productType: string
): Array<{ type: 'error' | 'warning'; message: string }> {
  const warnings: Array<{ type: 'error' | 'warning'; message: string }> = [];
  
  const missing = validateComplianceFields(product, productType);
  
  if (missing.length > 0) {
    warnings.push({
      type: 'error',
      message: `${missing.length} erforderliche Felder fehlen für die Konformität: ${missing.join(', ')}`,
    });
  }
  
  // Check for hazard fields in chemical products
  if (productType === 'CHEMICAL') {
    const hasHazardInfo = Object.keys(product).some(key =>
      isHazardField(key) && product[key]
    );
    
    if (!hasHazardInfo) {
      warnings.push({
        type: 'warning',
        message: 'Keine Gefahrstoffinformationen gefunden. Bitte überprüfen Sie die PDF.',
      });
    }
  }
  
  return warnings;
}
