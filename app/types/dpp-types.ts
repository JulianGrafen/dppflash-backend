/**
 * Basis-Interface für alle Produktpässe.
 * Enthält Felder, die für jede EU-Regulierung (ESPR) identisch sind. 
 */
export interface BaseDPP {
  readonly id: string;
  readonly createdAt: Date;
  hersteller: string;
  modellname: string;
}

/**
 * Spezifische Anforderungen für Batterien (Pflicht ab 2026). 
 */
export interface BatteryDPP extends BaseDPP {
  readonly type: 'BATTERY';
  kapazitaetKWh: number;
  chemischesSystem: string;
}

/**
 * Spezifische Anforderungen für Textilien (Pflicht ab ca. 2027). 
 */
export interface TextileDPP extends BaseDPP {
  readonly type: 'TEXTILE';
  materialZusammensetzung: string;
  herkunftsland: string;
}

/** * Union Type für einfache Erweiterbarkeit um künftige Kategorien wie Möbel oder Elektronik. 
 */
export type ProductPassport = BatteryDPP | TextileDPP;