import rawWasteMapping from '@/app/infrastructure/data/eak-mapping.json';

export interface WasteMappingRow {
  readonly column: readonly string[];
}

export interface WasteMapping {
  readonly table: {
    readonly row: readonly WasteMappingRow[];
  };
}

export interface WasteCodeResolution {
  readonly code: string;
  readonly normalizedCode: string;
  readonly hazardous: boolean;
  readonly found: boolean;
  readonly description?: string;
  readonly instruction: string;
}

const HAZARDOUS_WASTE_INSTRUCTION =
  'Gefaehrlicher Abfall: Fachgerechte Entsorgung ueber zertifizierte Entsorgungsfachbetriebe erforderlich.';

const UNKNOWN_WASTE_CODE_INSTRUCTION =
  'Abfallschluessel nicht im Mapping gefunden: manuelle Pruefung durch die Fachabteilung erforderlich.';

function buildLookup(mapping: WasteMapping): ReadonlyMap<string, string> {
  return new Map(
    mapping.table.row.flatMap((row) => {
      const [baseCode, hazardousMarker = '', description = ''] = row.column;

      if (!baseCode || !description) {
        return [];
      }

      const key = `${baseCode}${hazardousMarker === '*' ? '*' : ''}`;
      return [[key, description] as const];
    }),
  );
}

function normalizeDigits(rawCode: string): { readonly digits: string; readonly markedHazardous: boolean } {
  return {
    digits: rawCode.replace(/\D/g, ''),
    markedHazardous: rawCode.includes('*'),
  };
}

export class WasteCodeService {
  private static readonly mapping = rawWasteMapping as unknown as WasteMapping;

  private static readonly lookup = buildLookup(WasteCodeService.mapping);

  static normalize(rawCode: string): string {
    const trimmedCode = rawCode.trim();

    if (!trimmedCode) {
      return '';
    }

    const { digits, markedHazardous } = normalizeDigits(trimmedCode);

    if (digits.length !== 6) {
      return trimmedCode.replace(/\s+/g, ' ');
    }

    const formattedCode = `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)}`;
    const exactHazardousKey = `${formattedCode}*`;
    const exactNonHazardousKey = formattedCode;

    if (markedHazardous) {
      return exactHazardousKey;
    }

    if (WasteCodeService.lookup.has(exactNonHazardousKey)) {
      return exactNonHazardousKey;
    }

    if (WasteCodeService.lookup.has(exactHazardousKey)) {
      return exactHazardousKey;
    }

    return exactNonHazardousKey;
  }

  static resolve(rawCode: string): WasteCodeResolution {
    const normalizedCode = WasteCodeService.normalize(rawCode);
    const description = WasteCodeService.lookup.get(normalizedCode);
    const hazardous = normalizedCode.endsWith('*');

    if (!description) {
      return {
        code: rawCode,
        normalizedCode,
        hazardous,
        found: false,
        instruction: UNKNOWN_WASTE_CODE_INSTRUCTION,
      };
    }

    const instruction = hazardous
      ? `${description} ${HAZARDOUS_WASTE_INSTRUCTION}`
      : description;

    return {
      code: rawCode,
      normalizedCode,
      hazardous,
      found: true,
      description,
      instruction,
    };
  }
}
