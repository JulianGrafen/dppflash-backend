/**
 * Translations: Field Labels
 * Multi-language support for product field names
 * Supports: German (de), English (en), French (fr), Spanish (es), Italian (it)
 */

export type SupportedLanguage = 'de' | 'en' | 'fr' | 'es' | 'it';

export const FIELD_TRANSLATIONS: Record<SupportedLanguage, Record<string, string>> = {
  de: {
    // Common
    'hersteller': 'Hersteller',
    'modellname': 'Modellname',
    'createdAt': 'Erstellt am',
    'language': 'Sprache',
    'type': 'Produkttyp',
    'id': 'Produkt-ID',
    
    // Battery Fields
    'kapazitaetKWh': 'Kapazität (kWh)',
    'chemischesSystem': 'Chemisches System',
    'batterietyp': 'Batterietyp',
    'produktionsdatum': 'Produktionsdatum',
    'recyclinganteilKobalt': 'Recyclinganteil Kobalt (%)',
    'recyclinganteilLithium': 'Recyclinganteil Lithium (%)',
    'recyclinganteilNickel': 'Recyclinganteil Nickel (%)',
    'co2FussabdruckKgProKwh': 'CO₂-Fußabdruck (kg CO₂e/kWh)',
    'erwarteteLebensdauerLadezyklen': 'Erwartete Lebensdauer (Ladezyklen)',
    'reparierbarkeitsIndex': 'Reparierbarkeits-Index',
    'ersatzteileVerfuegbarkeitJahre': 'Ersatzteile-Verfügbarkeit (Jahre)',
    'recyclingAnweisungen': 'Recycling-Anweisungen',
    
    // Textile Fields
    'materialZusammensetzung': 'Material-Zusammensetzung',
    'herkunftsland': 'Herkunftsland',
    'verarbeitungsland': 'Verarbeitungsland',
    'pflegehinweise': 'Pflegehinweise',
    'nachhaltigkeit': 'Nachhaltigkeit',
    
    // Electronics Fields
    'produkttyp': 'Produkttyp',
    'stromverbrauch': 'Stromverbrauch (Watt)',
    'energieeffizienzklasse': 'Energieeffizienzklasse',
    'lebensdauer': 'Lebensdauer (Jahre)',
    'reparierbarkeit': 'Reparierbarkeit',
    'sicherheitsmerkmale': 'Sicherheitsmerkmale',
    
    // Furniture Fields
    'material': 'Material',
    'abmessungen': 'Abmessungen',
    'gewicht': 'Gewicht (kg)',
    'zerlegbarkeit': 'Zerlegbarkeit',
    'nachhaltigkeitszertifikat': 'Nachhaltigkeitszertifikat',
    
    // Paint Fields
    'zusammensetzung': 'Zusammensetzung',
    'gefahrenstoffe': 'Gefahrenstoffe',
    'verwendung': 'Verwendung',
    'lagerbedingungen': 'Lagerbedingungen',
    'entsorgungshinweise': 'Entsorgungshinweise',
    'voc': 'VOC (g/l)',
    
    // Lubricant Fields
    'viskositaet': 'Viskosität',
    'temperaturbereich': 'Temperaturbereich',
    'umweltfreundlichkeit': 'Umweltfreundlichkeit',
    
    // Tyre Fields
    'reifengross': 'Reifengröße',
    'lastindex': 'Lastindex',
    'geschwindigkeitsindex': 'Geschwindigkeitsindex',
    'energieeffizienz': 'Energieeffizienz',
    'nassgriffleistung': 'Nassgriffleistung',
    'aussengeraeusch': 'Außengeräusch (dB)',
    'recyclingmerkmale': 'Recyclingmerkmale',
    
    // Plastic Fields
    'kunststoffart': 'Kunststoffart',
    'recyclinggehalt': 'Recyclinggehalt (%)',
    'recyclingfaehigkeit': 'Recycfähigkeit',
    'abbaubarkeit': 'Abbaubarkeit',
    'herkunftsrohstoffe': 'Herkunftsrohstoffe',
    'verwendungszweck': 'Verwendungszweck',
    
    // Appliance Fields
    'energie_kwh': 'Energie (kWh pro Zyklus)',
    'wasser_liter': 'Wasser (l pro Zyklus)',
    'kapazitaet_kg': 'Kapazität (kg)',
    'geraeusch_db': 'Geräusch (dB)',
    'haltbarkeit_jahre': 'Haltbarkeit (Jahre)',
    'volumen_liter': 'Volumen (l)',
    'energieverbrauch_kwh': 'Energieverbrauch (kWh/Jahr)',
    'klimaklasse': 'Klimaklasse',
    'kuehlmittel': 'Kühlmittel',
    
    // Lighting Fields
    'leuchtenart': 'Leuchtenart',
    'leistung_watt': 'Leistung (W)',
    'lichtstrom_lumen': 'Lichtstrom (lm)',
    'farbtemperatur_kelvin': 'Farbtemperatur (K)',
    'lebensdauer_std': 'Lebensdauer (Std)',
    'quecksilbergehalt': 'Quecksilbergehalt',
  },
  
  en: {
    // Common
    'hersteller': 'Manufacturer',
    'modellname': 'Model Name',
    'createdAt': 'Created',
    'language': 'Language',
    'type': 'Product Type',
    'id': 'Product ID',
    
    // Battery Fields
    'kapazitaetKWh': 'Capacity (kWh)',
    'chemischesSystem': 'Chemical System',
    'batterietyp': 'Battery Type',
    'produktionsdatum': 'Production Date',
    'recyclinganteilKobalt': 'Recycling Content Cobalt (%)',
    'recyclinganteilLithium': 'Recycling Content Lithium (%)',
    'recyclinganteilNickel': 'Recycling Content Nickel (%)',
    'co2FussabdruckKgProKwh': 'CO₂ Footprint (kg CO₂e/kWh)',
    'erwarteteLebensdauerLadezyklen': 'Expected Lifespan (Charge Cycles)',
    'reparierbarkeitsIndex': 'Repairability Index',
    'ersatzteileVerfuegbarkeitJahre': 'Spare Parts Availability (Years)',
    'recyclingAnweisungen': 'Recycling Instructions',
    
    // Textile Fields
    'materialZusammensetzung': 'Material Composition',
    'herkunftsland': 'Country of Origin',
    'verarbeitungsland': 'Processing Country',
    'pflegehinweise': 'Care Instructions',
    'nachhaltigkeit': 'Sustainability',
    
    // Electronics Fields
    'produkttyp': 'Product Type',
    'stromverbrauch': 'Power Consumption (Watt)',
    'energieeffizienzklasse': 'Energy Efficiency Class',
    'lebensdauer': 'Lifespan (Years)',
    'reparierbarkeit': 'Repairability',
    'sicherheitsmerkmale': 'Safety Features',
    
    // Furniture Fields
    'material': 'Material',
    'abmessungen': 'Dimensions',
    'gewicht': 'Weight (kg)',
    'zerlegbarkeit': 'Disassemblability',
    'nachhaltigkeitszertifikat': 'Sustainability Certificate',
    
    // Paint Fields
    'zusammensetzung': 'Composition',
    'gefahrenstoffe': 'Hazardous Substances',
    'verwendung': 'Usage',
    'lagerbedingungen': 'Storage Conditions',
    'entsorgungshinweise': 'Disposal Instructions',
    'voc': 'VOC (g/l)',
    
    // Lubricant Fields
    'viskositaet': 'Viscosity',
    'temperaturbereich': 'Temperature Range',
    'umweltfreundlichkeit': 'Environmental Friendliness',
    
    // Tyre Fields
    'reifengross': 'Tyre Size',
    'lastindex': 'Load Index',
    'geschwindigkeitsindex': 'Speed Index',
    'energieeffizienz': 'Energy Efficiency',
    'nassgriffleistung': 'Wet Grip Performance',
    'aussengeraeusch': 'External Noise (dB)',
    'recyclingmerkmale': 'Recycling Features',
    
    // Plastic Fields
    'kunststoffart': 'Plastic Type',
    'recyclinggehalt': 'Recycling Content (%)',
    'recyclingfaehigkeit': 'Recyclability',
    'abbaubarkeit': 'Degradability',
    'herkunftsrohstoffe': 'Raw Material Source',
    'verwendungszweck': 'Intended Use',
    
    // Appliance Fields
    'energie_kwh': 'Energy (kWh per cycle)',
    'wasser_liter': 'Water (l per cycle)',
    'kapazitaet_kg': 'Capacity (kg)',
    'geraeusch_db': 'Noise (dB)',
    'haltbarkeit_jahre': 'Durability (Years)',
    'volumen_liter': 'Volume (l)',
    'energieverbrauch_kwh': 'Energy Consumption (kWh/Year)',
    'klimaklasse': 'Climate Class',
    'kuehlmittel': 'Refrigerant',
    
    // Lighting Fields
    'leuchtenart': 'Luminaire Type',
    'leistung_watt': 'Power (W)',
    'lichtstrom_lumen': 'Luminous Flux (lm)',
    'farbtemperatur_kelvin': 'Color Temperature (K)',
    'lebensdauer_std': 'Lifespan (Hours)',
    'quecksilbergehalt': 'Mercury Content',
  },
  
  fr: {
    // Common
    'hersteller': 'Fabricant',
    'modellname': 'Nom du modèle',
    'createdAt': 'Créé',
    'language': 'Langue',
    'type': 'Type de produit',
    'id': 'ID produit',
    
    // Battery Fields
    'kapazitaetKWh': 'Capacité (kWh)',
    'chemischesSystem': 'Système chimique',
    'batterietyp': 'Type de batterie',
    'produktionsdatum': 'Date de production',
    'recyclinganteilKobalt': 'Contenu recyclé Cobalt (%)',
    'recyclinganteilLithium': 'Contenu recyclé Lithium (%)',
    'recyclinganteilNickel': 'Contenu recyclé Nickel (%)',
    'co2FussabdruckKgProKwh': 'Empreinte CO₂ (kg CO₂e/kWh)',
    'erwarteteLebensdauerLadezyklen': 'Durée de vie attendue (Cycles de charge)',
    'reparierbarkeitsIndex': 'Indice de réparabilité',
    'ersatzteileVerfuegbarkeitJahre': 'Disponibilité des pièces de rechange (Années)',
    'recyclingAnweisungen': 'Instructions de recyclage',
    
    // Additional fields for French...
    'materialZusammensetzung': 'Composition des matériaux',
    'herkunftsland': 'Pays d\'origine',
    'stromverbrauch': 'Consommation électrique (Watt)',
    'energieeffizienzklasse': 'Classe d\'efficacité énergétique',
    'lebensdauer': 'Durée de vie (Années)',
  },
  
  es: {
    // Common
    'hersteller': 'Fabricante',
    'modellname': 'Nombre del modelo',
    'createdAt': 'Creado',
    'language': 'Idioma',
    'type': 'Tipo de producto',
    'id': 'ID del producto',
    
    // Battery Fields
    'kapazitaetKWh': 'Capacidad (kWh)',
    'chemischesSystem': 'Sistema químico',
    'batterietyp': 'Tipo de batería',
    'co2FussabdruckKgProKwh': 'Huella de carbono (kg CO₂e/kWh)',
    
    // Additional fields for Spanish...
    'materialZusammensetzung': 'Composición de materiales',
    'herkunftsland': 'País de origen',
    'stromverbrauch': 'Consumo de energía (Watt)',
    'energieeffizienzklasse': 'Clase de eficiencia energética',
  },
  
  it: {
    // Common
    'hersteller': 'Produttore',
    'modellname': 'Nome del modello',
    'createdAt': 'Creato',
    'language': 'Lingua',
    'type': 'Tipo di prodotto',
    'id': 'ID prodotto',
    
    // Battery Fields
    'kapazitaetKWh': 'Capacità (kWh)',
    'chemischesSystem': 'Sistema chimico',
    'batterietyp': 'Tipo di batteria',
    'co2FussabdruckKgProKwh': 'Impronta di carbonio (kg CO₂e/kWh)',
    
    // Additional fields for Italian...
    'materialZusammensetzung': 'Composizione dei materiali',
    'herkunftsland': 'Paese di origine',
    'stromverbrauch': 'Consumo energetico (Watt)',
    'energieeffizienzklasse': 'Classe di efficienza energetica',
  },
};

/**
 * Get translated field label in specified language
 */
export function getFieldLabel(
  fieldKey: string,
  language: SupportedLanguage = 'de'
): string {
  const translations = FIELD_TRANSLATIONS[language] || FIELD_TRANSLATIONS.de;
  return translations[fieldKey] || fieldKey;
}

/**
 * Get language name in German
 */
export function getLanguageName(lang: string): string {
  const names: Record<string, string> = {
    de: 'Deutsch',
    en: 'English',
    fr: 'Français',
    es: 'Español',
    it: 'Italiano',
  };
  return names[lang] || lang;
}

/**
 * Detect likely language from product data
 * Returns ISO language code ('de', 'en', etc.)
 */
export function detectLanguageFromText(text: string): SupportedLanguage {
  const germanWords = ['und', 'der', 'die', 'das', 'ein', 'hersteller', 'modellname'];
  const englishWords = ['and', 'the', 'a', 'an', 'manufacturer', 'model'];
  const frenchWords = ['et', 'le', 'la', 'les', 'un', 'fabricant'];
  
  const lowerText = text.toLowerCase();
  
  let germanScore = germanWords.filter(w => lowerText.includes(w)).length;
  let englishScore = englishWords.filter(w => lowerText.includes(w)).length;
  let frenchScore = frenchWords.filter(w => lowerText.includes(w)).length;
  
  if (germanScore > englishScore && germanScore > frenchScore) return 'de';
  if (englishScore > germanScore && englishScore > frenchScore) return 'en';
  if (frenchScore > germanScore && frenchScore > englishScore) return 'fr';
  
  return 'de'; // Default to German
}
