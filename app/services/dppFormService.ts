import { v4 as uuidv4 } from 'uuid';
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
      id: uuidv4(), // Eindeutige ID für den QR-Link
      createdAt: new Date(),
      language: 'de',
      hersteller: '',
      modellname: '',
    };

    if (type === 'BATTERY') {
      return { ...base, type: 'BATTERY', kapazitaetKWh: 0, chemischesSystem: '' };
    }

    return { ...base, type: 'TEXTILE', materialZusammensetzung: '', herkunftsland: '' };
  }

  /**
   * Validiert, ob alle EU-Pflichtfelder für die jeweilige Kategorie befüllt sind.
   */
  static isValid(data: ProductPassport): boolean {
    const hasBaseFields = !!(data.hersteller && data.modellname);
    
    switch (data.type) {
      case 'BATTERY':
        return hasBaseFields && (data as any).kapazitaetKWh > 0 && !!(data as any).chemischesSystem;
      case 'TEXTILE':
        return hasBaseFields && !!(data as any).materialZusammensetzung && !!(data as any).herkunftsland;
      default:
        return false;
    }
  }
}