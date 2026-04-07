/**
 * Utility: ProductDisplay
 * Formatierung, Feldnamen und Icons für Produktanzeige
 */

import {
  Zap,
  Shirt,
  Settings,
  Package,
  Droplet,
  Hammer,
  Lightbulb,
  Wind,
  Info,
} from 'lucide-react';

// Produkttyp-Konfiguration
export const PRODUCT_TYPE_CONFIG: Record<string, {
  label: string;
  icon: React.ComponentType<any>;
  color: string;
  fields: string[];
}> = {
  BATTERY: {
    label: '🔋 Batterie',
    icon: Zap,
    color: 'blue',
    fields: [
      'kapazitaetKWh',
      'chemischesSystem',
      'batterietyp',
      'co2FussabdruckKgProKwh',
      'erwarteteLebensdauerLadezyklen',
      'recyclinganteilLithium',
    ],
  },
  TEXTILE: {
    label: '👕 Textil',
    icon: Shirt,
    color: 'purple',
    fields: ['materialZusammensetzung', 'herkunftsland', 'pflegehinweise'],
  },
  ELECTRONICS: {
    label: '🖥️  Elektronik',
    icon: Settings,
    color: 'orange',
    fields: ['stromverbrauch', 'energieeffizienzklasse', 'lebensdauer'],
  },
  FURNITURE: {
    label: '🪑 Möbel',
    icon: Package,
    color: 'amber',
    fields: ['material', 'abmessungen', 'gewicht', 'zerlegbarkeit'],
  },
  PAINT: {
    label: '🎨 Farben & Lacke',
    icon: Droplet,
    color: 'pink',
    fields: ['zusammensetzung', 'voc', 'entsorgungshinweise'],
  },
  LUBRICANT: {
    label: '🛢️  Schmierstoffe',
    icon: Droplet,
    color: 'amber',
    fields: ['zusammensetzung', 'viskositaet', 'temperaturbereich'],
  },
  TYRE: {
    label: '🛞 Reifen',
    icon: Wind,
    color: 'slate',
    fields: ['reifengross', 'energieeffizienz', 'nassgriffleistung'],
  },
  PLASTIC: {
    label: '♻️  Kunststoff',
    icon: Info,
    color: 'green',
    fields: ['kunststoffart', 'recyclinggehalt', 'recyclingfaehigkeit'],
  },
  WASHER: {
    label: '🧺 Waschmaschine',
    icon: Wind,
    color: 'cyan',
    fields: ['energie_kwh', 'wasser_liter', 'kapazitaet_kg'],
  },
  REFRIGERATOR: {
    label: '❄️  Kühlgerät',
    icon: Wind,
    color: 'blue',
    fields: ['volumen_liter', 'energieverbrauch_kwh', 'kuehlmittel'],
  },
  LIGHTING: {
    label: '💡 Beleuchtung',
    icon: Lightbulb,
    color: 'yellow',
    fields: ['leuchtenart', 'leistung_watt', 'lichtstrom_lumen'],
  },
  CHEMICAL: {
    label: '⚗️  Chemikalien',
    icon: Droplet,
    color: 'orange',
    fields: ['zusammensetzung', 'gefahrenstoffe', 'entsorgungshinweise'],
  },
  OTHER: {
    label: '📦 Produkt',
    icon: Package,
    color: 'gray',
    fields: [],
  },
};

// Feldnamen-Mapping (camelCase → Lesbar)
export const FIELD_NAME_MAP: Record<string, string> = {
  'hersteller': 'Hersteller',
  'modellname': 'Modellname',
  'createdAt': 'Erstellt am',
  'language': 'Sprache',
  'type': 'Produkttyp',
  'id': 'Produkt-ID',

  // Batterie
  'seriennummer': 'Seriennummer',
  'nennspannungV': 'Nennspannung (V)',
  'gewichtKg': 'Gewicht (kg)',
  'referenznummer': 'Referenznummer',
  'zertifizierungsstelle': 'Zertifizierungsstelle',
  'rechtlicheHinweise': 'Rechtliche Hinweise',
  'kapazitaetKWh': 'Kapazität (kWh)',
  'chemischesSystem': 'Chemisches System',
  'batterietyp': 'Batterietyp',
  'produktionsdatum': 'Produktionsdatum',
  'recyclinganteilKobalt': 'Recyclinganteil Kobalt (%)',
  'recyclinganteilLithium': 'Recyclinganteil Lithium (%)',
  'recyclinganteilNickel': 'Recyclinganteil Nickel (%)',
  'co2FussabdruckKgGesamt': 'CO₂-Fußabdruck Gesamt (kg CO₂e)',
  'co2FussabdruckKgProKwh': 'CO₂-Fußabdruck (kg CO₂e/kWh)',
  'erwarteteLebensdauerLadezyklen': 'Erwartete Lebensdauer (Ladezyklen)',
  'reparierbarkeitsIndex': 'Reparierbarkeits-Index',
  'ersatzteileVerfuegbarkeitJahre': 'Ersatzteile-Verfügbarkeit (Jahre)',
  'recyclingAnweisungen': 'Recycling-Anweisungen',

  // Textil
  'materialZusammensetzung': 'Material-Zusammensetzung',
  'herkunftsland': 'Herkunftsland',
  'verarbeitungsland': 'Verarbeitungsland',
  'pflegehinweise': 'Pflegehinweise',
  'nachhaltigkeit': 'Nachhaltigkeit',

  // Elektronik
  'produkttyp': 'Produkttyp',
  'stromverbrauch': 'Stromverbrauch (Watt)',
  'energieeffizienzklasse': 'Energieeffizienzklasse',
  'lebensdauer': 'Lebensdauer (Jahre)',
  'reparierbarkeit': 'Reparierbarkeit',
  'sicherheitsmerkmale': 'Sicherheitsmerkmale',

  // Möbel
  'material': 'Material',
  'abmessungen': 'Abmessungen',
  'gewicht': 'Gewicht (kg)',
  'zerlegbarkeit': 'Zerlegbarkeit',
  'nachhaltigkeitszertifikat': 'Nachhaltigkeitszertifikat',

  // Farben & Lacke
  'zusammensetzung': 'Zusammensetzung',
  'gefahrenstoffe': 'Gefahrenstoffe',
  'verwendung': 'Verwendung',
  'lagerbedingungen': 'Lagerbedingungen',
  'entsorgungshinweise': 'Entsorgungshinweise',
  'voc': 'VOC (g/l)',

  // Schmierstoffe
  'viskositaet': 'Viskosität',
  'temperaturbereich': 'Temperaturbereich',
  'umweltfreundlichkeit': 'Umweltfreundlichkeit',

  // Reifen
  'reifengross': 'Reifengröße',
  'lastindex': 'Lastindex',
  'geschwindigkeitsindex': 'Geschwindigkeitsindex',
  'energieeffizienz': 'Energieeffizienz',
  'nassgriffleistung': 'Nassgriffleistung',
  'aussengeraeusch': 'Außengeräusch (dB)',
  'recyclingmerkmale': 'Recyclingmerkmale',

  // Kunststoff
  'kunststoffart': 'Kunststoffart',
  'recyclinggehalt': 'Recyclinggehalt (%)',
  'recyclingfaehigkeit': 'Recycfähigkeit',
  'abbaubarkeit': 'Abbaubarkeit',
  'herkunftsrohstoffe': 'Herkunftsrohstoffe',
  'verwendungszweck': 'Verwendungszweck',

  // Waschmaschinen
  'energie_kwh': 'Energie (kWh pro Zyklus)',
  'wasser_liter': 'Wasser (l pro Zyklus)',
  'kapazitaet_kg': 'Kapazität (kg)',
  'geraeusch_db': 'Geräusch (dB)',
  'haltbarkeit_jahre': 'Haltbarkeit (Jahre)',

  // Kühlgeräte
  'volumen_liter': 'Volumen (l)',
  'energieverbrauch_kwh': 'Energieverbrauch (kWh/Jahr)',
  'klimaklasse': 'Klimaklasse',
  'kuehlmittel': 'Kühlmittel',

  // Beleuchtung
  'leuchtenart': 'Leuchtenart',
  'leistung_watt': 'Leistung (W)',
  'lichtstrom_lumen': 'Lichtstrom (lm)',
  'farbtemperatur_kelvin': 'Farbtemperatur (K)',
  'lebensdauer_std': 'Lebensdauer (Std)',
  'quecksilbergehalt': 'Quecksilbergehalt',
};

/**
 * Formatiert einen Wert für die Anzeige
 */
export function formatValue(value: any): string {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'boolean') return value ? 'Ja' : 'Nein';
  if (value instanceof Date) return value.toLocaleDateString('de-DE');
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'number') {
    return !Number.isInteger(value) ? value.toFixed(2) : value.toString();
  }
  return String(value);
}

/**
 * Gibt einen Feldnamen in lesbarer Form zurück
 */
export function formatFieldName(key: string): string {
  return FIELD_NAME_MAP[key] || key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

/**
 * Gibt Produkttyp-Name und Icon zurück
 */
export function getProductTypeInfo(type: string) {
  const config = PRODUCT_TYPE_CONFIG[type] || PRODUCT_TYPE_CONFIG.OTHER;
  return {
    name: config.label,
    icon: config.icon,
    color: config.color,
  };
}

/**
 * Kategorisiert Felder nach Bereich
 */
export function groupFieldsByCategory(product: any): Record<string, [string, string][]> {
  const baseFields = new Set(['hersteller', 'modellname', 'createdAt', 'language', 'seriennummer', 'produktionsdatum', 'referenznummer']);
  const esprKeywords = ['co2', 'lebensdauer', 'reparierbarkeit', 'ersatzteile', 'entsorgung', 'gefahrstoff', 'voc'];
  const sustainabilityKeywords = ['recycling', 'nachhaltig', 'umwelt', 'co2'];
  const legalFields = new Set(['zertifizierungsstelle', 'rechtlichehinweise', 'rechtliche']);

  const grouped: Record<string, [string, string][]> = {
    'Allgemeine Informationen': [],
    'Spezifikationen': [],
    'ESPR-Anforderungen': [],
    'Nachhaltigkeit & Recycling': [],
    'Rechtliches': [],
    'Weitere Daten': [],
  };

  for (const [key, value] of Object.entries(product)) {
    if (['__proto__', '_id', '_type', 'id', 'type'].includes(key)) continue;
    if (value === null || value === undefined || value === '') continue;

    const fieldName = formatFieldName(key);
    const fieldValue = formatValue(value);
    const lowerKey = key.toLowerCase();

    if (baseFields.has(key)) {
      grouped['Allgemeine Informationen'].push([fieldName, fieldValue]);
    } else if (legalFields.has(lowerKey)) {
      grouped['Rechtliches'].push([fieldName, fieldValue]);
    } else if (sustainabilityKeywords.some(f => lowerKey.includes(f))) {
      grouped['Nachhaltigkeit & Recycling'].push([fieldName, fieldValue]);
    } else if (esprKeywords.some(f => lowerKey.includes(f))) {
      grouped['ESPR-Anforderungen'].push([fieldName, fieldValue]);
    } else {
      grouped['Spezifikationen'].push([fieldName, fieldValue]);
    }
  }

  return grouped;
}
