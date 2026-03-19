import { ProductPassport } from '../types/dpp-types';

/**
 * Factory-Klasse zur Erstellung valider Produktpass-Objekte.
 * Trennt die UI-Logik von der Datenstruktur (Single Responsibility).
 */
export class DPPFactory {
  /**
   * Erzeugt ein initiales, leeres Produktobjekt basierend auf der Kategorie.
   */
  static createEmptyPassport(type: ProductPassport['type']): ProductPassport {
    const base = {
      id: crypto.randomUUID(), // Eindeutige ID für den QR-Link [cite: 21]
      createdAt: new Date(),
      hersteller: '',
      modellname: '',
    };

    if (type === 'BATTERY') {
      return { ...base, type: 'BATTERY', kapazitaetKWh: 0, chemischesSystem: '' };
    }

    return { ...base, type: 'TEXTILE', materialZusammensetzung: '', herkunftsland: '' };
  }

  /**
   * Validiert, ob alle EU-Pflichtfelder für die jeweilige Kategorie befüllt sind. [cite: 56]
   */
  static isValid(data: ProductPassport): boolean {
    const hasBaseFields = !!(data.hersteller && data.modellname);
    
    switch (data.type) {
      case 'BATTERY':
        return hasBaseFields && data.kapazitaetKWh > 0 && !!data.chemischesSystem;
      case 'TEXTILE':
        return hasBaseFields && !!data.materialZusammensetzung && !!data.herkunftsland;
      default:
        return false;
    }
  }
}