import { AIProvider } from './aiProvider';
import { ProductPassport, AIExtractionOutput } from '../types/dpp-types';

/**
 * Lokale DSGVO-konforme Extraktions-Engine.
 * 
 * ✅ 100% DSGVO-konform: Null Daten verlassen Deutschland/Server
 * ✅ Keine API-Calls zu OpenAI oder externen Dienste
 * ✅ Schnell und kostenlos
 * ✅ Intelligente Multi-Strategie: Muster → Listen → Heuristiken
 */

export class MockLocalProvider implements AIProvider {
  async extractProductData(
    pdfText: string,
    productTypeHint?: ProductPassport['type']
  ): Promise<AIExtractionOutput> {
    // Wenn produktTypeHint vorhanden, nutze diesen direkt
    if (productTypeHint) {
      const productType = productTypeHint;
      console.log('🎯 Produkttyp vorgegeben:', productType);

      try {
        switch (productType) {
          case 'BATTERY':
            return this.extractBatteryData(pdfText);
          case 'TEXTILE':
            return this.extractTextileData(pdfText);
          case 'ELECTRONICS':
            return this.extractElectronicsData(pdfText);
          case 'FURNITURE':
            return this.extractFurnitureData(pdfText);
          case 'CHEMICAL':
            return this.extractChemicalData(pdfText);
          default:
            return this.extractGenericData(pdfText, productType as string);
        }
      } catch (error) {
        console.error('Produkttyp-spezifische Extraktion ERROR:', error);
        return this.extractGenericData(pdfText, productType as string);
      }
    }

    // Automatische Produkttyp-Erkennung
    const detectedType = this.detectProductType(pdfText);
    console.log('🔍 Automatisch erkannter Produkttyp:', detectedType);

    try {
      switch (detectedType) {
        case 'BATTERY':
          return this.extractBatteryData(pdfText);
        case 'TEXTILE':
          return this.extractTextileData(pdfText);
        case 'ELECTRONICS':
          return this.extractElectronicsData(pdfText);
        case 'FURNITURE':
          return this.extractFurnitureData(pdfText);
        case 'CHEMICAL':
          return this.extractChemicalData(pdfText);
        default:
          return this.extractGenericData(pdfText, detectedType);
      }
    } catch (error) {
      console.error('Lokale Extraktion ERROR:', error);
      return {
        productType: detectedType,
        confidence: 0,
        extractedFields: {},
        warnings: [
          `Lokale Extraktion fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannt'}`
        ],
      };
    }
  }

  private detectProductType(text: string): ProductPassport['type'] {
    const lowerText = text.toLowerCase();

    // Batterie-Keywords
    const batteryKeywords = [
      'batterie', 'battery', 'akku', 'kwh', 'kw', 'zelle', 'cell',
      'lade', 'charge', 'lithium', 'nmc', 'lfp', 'lipo', 'energiespeicher'
    ];

    // Textil-Keywords
    const textileKeywords = [
      'textil', 'textile', 'stoff', 'fabric', 'kleidung', 'clothing',
      'baumwolle', 'cotton', 'polyester', 'wolle', 'silk', 'seide',
      'material', 'gewebe', 'faser', 'fiber'
    ];

    // Elektronik-Keywords
    const electronicsKeywords = [
      'elektronik', 'electronics', 'computer', 'prozessor', 'cpu', 'modul',
      'platine', 'circuit', 'watt', 'volt', 'ampere', 'schaltung',
      'sensor', 'display', 'bildschirm', 'power consumption'
    ];

    // Möbel-Keywords
    const furnitureKeywords = [
      'möbel', 'furniture', 'holz', 'wood', 'metall', 'metal', 'stuhl', 'chair',
      'tisch', 'table', 'schrank', 'cabinet', 'sofa', 'couch', 'sessel',
      'abmessung', 'dimensions', 'größe', 'gewicht', 'weight'
    ];

    // Chemikalien-Keywords
    const chemicalKeywords = [
      'chemie', 'chemical', 'substanz', 'substance', 'gefahrstoff', 'hazardous',
      'toxisch', 'toxic', 'sicherheit', 'safety', 'ghs', 'entsorgung', 'disposal',
      'zersetzung', 'decomposition'
    ];

    // Zähle Keyword-Vorkommen
    const scores = {
      BATTERY: batteryKeywords.filter(k => lowerText.includes(k)).length,
      TEXTILE: textileKeywords.filter(k => lowerText.includes(k)).length,
      ELECTRONICS: electronicsKeywords.filter(k => lowerText.includes(k)).length,
      FURNITURE: furnitureKeywords.filter(k => lowerText.includes(k)).length,
      CHEMICAL: chemicalKeywords.filter(k => lowerText.includes(k)).length,
    };

    // Finde den Produkttyp mit dem höchsten Score
    const detectedType = Object.entries(scores).reduce((prev, current) =>
      current[1] > prev[1] ? current : prev
    ) as [ProductPassport['type'], number];

    if (detectedType[1] > 0) {
      console.log(`✅ Produkttyp erkannt: ${detectedType[0]} (Score: ${detectedType[1]})`);
      return detectedType[0];
    }

    // Fallback auf generischen Typ
    console.log('⚠️ Produkttyp nicht erkannt, nutze generischen Typ');
    return 'OTHER';
  }

  private extractBatteryData(pdfText: string): AIExtractionOutput {
    console.log('🔋 Extrahiere Battery-Produktdaten mit ESPR-Feldern...');

    // Basis-Felder
    const hersteller = this.extractBatteryManufacturer(pdfText);
    const modellname = this.extractProductModel(pdfText);
    const kapazitaetKWh = this.extractBatteryCapacity(pdfText);
    const chemischesSystem = this.extractBatteryChemistry(pdfText);
    
    // ESPR-spezifische Felder
    const batterietyp = this.extractBatteryType(pdfText);
    const produktionsdatum = this.extractProductionDate(pdfText);
    const co2Fussabdruck = this.extractCO2Footprint(pdfText);
    const co2FussabdruckTotal = this.extractCO2Total(pdfText);
    const lebensdauer = this.extractLifespan(pdfText);
    const reparierbarkeitsIndex = this.extractRepairabilityIndex(pdfText);
    const ersatzteileVerfuegbarkeit = this.extractSparePartsAvailability(pdfText);
    const recyclingAnteilKobalt = this.extractRecyclingShare(pdfText, 'Kobalt');
    const recyclingAnteilLithium = this.extractRecyclingShare(pdfText, 'Lithium');
    const recyclingAnteilNickel = this.extractRecyclingShare(pdfText, 'Nickel');
    const recyclingAnweisungen = this.extractRecyclingInstructions(pdfText);
    // Zusätzliche Felder
    const seriennummer = this.extractSerialNumber(pdfText);
    const nennspannungV = this.extractVoltage(pdfText);
    const gewichtKg = this.extractWeightKg(pdfText);
    const zertifizierungsstelle = this.extractCertificationBody(pdfText);
    const referenznummer = this.extractReferenceNumber(pdfText);
    const rechtlicheHinweise = this.extractLegalNotes(pdfText);

    const missingFields = [];
    if (!hersteller) missingFields.push('Hersteller');
    if (!modellname) missingFields.push('Modellname');
    if (!kapazitaetKWh) missingFields.push('Kapazität');
    if (!chemischesSystem) missingFields.push('Chemisches System');

    const confidence = (4 - missingFields.length) / 4;

    const result: AIExtractionOutput = {
      productType: 'BATTERY',
      confidence,
      extractedFields: {
        type: 'BATTERY',
        hersteller: hersteller || '',
        modellname: modellname || '',
        kapazitaetKWh: kapazitaetKWh || 0,
        chemischesSystem: chemischesSystem || '',
        seriennummer: seriennummer || undefined,
        nennspannungV: nennspannungV || undefined,
        gewichtKg: gewichtKg || undefined,
        batterietyp: batterietyp || undefined,
        produktionsdatum: produktionsdatum || undefined,
        co2FussabdruckKgGesamt: co2FussabdruckTotal || undefined,
        co2FussabdruckKgProKwh: co2Fussabdruck || undefined,
        erwarteteLebensdauerLadezyklen: lebensdauer || undefined,
        reparierbarkeitsIndex: reparierbarkeitsIndex || undefined,
        ersatzteileVerfuegbarkeitJahre: ersatzteileVerfuegbarkeit || undefined,
        recyclinganteilKobalt: recyclingAnteilKobalt !== undefined ? recyclingAnteilKobalt : undefined,
        recyclinganteilLithium: recyclingAnteilLithium !== undefined ? recyclingAnteilLithium : undefined,
        recyclinganteilNickel: recyclingAnteilNickel !== undefined ? recyclingAnteilNickel : undefined,
        recyclingAnweisungen: recyclingAnweisungen || undefined,
        zertifizierungsstelle: zertifizierungsstelle || undefined,
        referenznummer: referenznummer || undefined,
        rechtlicheHinweise: rechtlicheHinweise || undefined,
      } as any,
      warnings: missingFields.length > 0
        ? [`Fehlende Felder: ${missingFields.join(', ')}`]
        : [],
    };

    console.log('✅ Battery Extraktion: ', {
      hersteller: (result.extractedFields as any).hersteller,
      modellname: (result.extractedFields as any).modellname,
      kapazitaet: (result.extractedFields as any).kapazitaetKWh,
      co2: (result.extractedFields as any).co2FussabdruckKgProKwh,
      lebensdauer: (result.extractedFields as any).erwarteteLebensdauerLadezyklen,
      confidence: confidence.toFixed(2),
    });

    return result;
  }

  private extractBatteryManufacturer(text: string): string {
    // Strategie 1: Kontext-basierte Extraktion.
    // Lookahead stoppt vor dem nächsten "Label:" Muster (z.B. "Modellname:", "Seriennummer:")
    const labelBoundary = /\s+[A-ZÄÖÜ][a-zäöü][a-zA-ZäöüÄÖÜß\s\-]*\s*:/;
    const contextPatterns = [
      /(?:hersteller|manufacturer|maker|brand|produzent|producer|fabrikant)[\s:]+(.+?)(?=\s+[A-ZÄÖÜ][a-zäöü][a-zA-ZäöüÄÖÜß\s\-]*\s*:|\n|,|;|$)/i,
      /^(?:unternehmen|company)[\s:]+(.+?)(?=\s+[A-ZÄÖÜ][a-zäöü][a-zA-ZäöüÄÖÜß\s\-]*\s*:|\n|,|;|$)/im,
    ];

    for (const pattern of contextPatterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        let candidate = match[1].trim();
        
        // Entferne nur irrelevante Suffixe nach dem Firmennamen
        candidate = candidate
          .replace(/\s+(?:all rights reserved|©|®|certif|cert|zertifikat).*$/i, '')
          .trim();
        
        // Behalte GmbH, AG, etc. - diese sind Teil des Firmennamens
        if (candidate.length > 2 && candidate.length < 80 && !candidate.match(/^(?:Ersatz|Recycling|Jahre|Der)/i)) {
          console.log(`✓ Hersteller (Kontext): ${candidate}`);
          return candidate;
        }
      }
    }

    // Strategie 2: Erweiterte Liste bekannter Hersteller mit keywords
    const batteryMakers = [
      // Batteriehersteller
      { name: 'Tesla', keywords: ['tesla'] },
      { name: 'Panasonic', keywords: ['panasonic'] },
      { name: 'Samsung SDI', keywords: ['samsung', 'sdi'] },
      { name: 'LG Chem', keywords: ['lg chem', 'lg', 'lge'] },
      { name: 'CATL', keywords: ['catl', 'contemporary'] },
      { name: 'BYD', keywords: ['byd'] },
      { name: 'Volkswagen', keywords: ['volkswagen', 'vw'] },
      { name: 'BMW', keywords: ['bmw'] },
      { name: 'Mercedes', keywords: ['mercedes', 'benz'] },
      { name: 'Audi', keywords: ['audi'] },
      { name: 'Porsche', keywords: ['porsche'] },
      { name: 'Hyundai', keywords: ['hyundai'] },
      { name: 'Kia', keywords: ['kia'] },
      { name: 'TechVolt GmbH', keywords: ['techvolt'] },
      { name: 'PowerCell', keywords: ['powercell'] },
      { name: 'Siemens', keywords: ['siemens'] },
      { name: 'Bosch', keywords: ['bosch'] },
      { name: 'ABB', keywords: ['abb'] },
      { name: 'Eaton', keywords: ['eaton'] },
    ];

    const lowerText = text.toLowerCase();
    
    // Suche nach Keywords mit Priority-Order
    for (const maker of batteryMakers) {
      for (const keyword of maker.keywords) {
        if (lowerText.includes(keyword)) {
          console.log(`✓ Hersteller (Liste): ${maker.name}`);
          return maker.name;
        }
      }
    }

    // Strategie 3: Suche nach Firmennamen-Muster (mit oder ohne Suffix)
    // Aber nicht am Anfang einer Zeile, die mit sonstigen Keywords beginnt
    const companyPatterns = [
      // Firma mit GmbH/AG/etc. am Ende - aber nicht wenn Ersatz/Recycling vorher kommt
      /(?<!ersatz)(?<!recycling)\b([A-Z][a-zA-Z0-9\s]+(?:GmbH|AG|Inc|Ltd|LLC|SE|SA|BV))\b/,
      // Mehrere Wörter (Großbuchstaben am Anfang) mit Suffix
      /\b([A-Z][a-zA-Z0-9\s&\-]{4,60})\s+(?:GmbH|AG|Inc|Ltd|LLC|SE|SA|KG|OHG|KGaA)\b/i,
    ];

    for (const pattern of companyPatterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        const candidate = match[1].trim();
        if (candidate.length > 2 && candidate.length < 80 && /[A-Z]/.test(candidate) && !candidate.match(/^(?:Ersatz|Recycling|Jahre)/)) {
          console.log(`✓ Hersteller (Firmenmuster): ${candidate}`);
          return candidate;
        }
      }
    }

    // Strategie 4: Suche nach großgeschriebenen Wörtern als Fallback
    // Bevorzuge längere Firmennamen, aber ignoriere Keywords
    const capitalWords = text.match(/\b[A-Z][a-zA-Z]{2,25}\b/g) || [];
    if (capitalWords.length > 0) {
      // Bevorzuge längere Wörter (mindestens 5 Buchstaben für einen guten Firmennamen)
      const longWords = capitalWords.filter(w => w.length > 4 && !['Model', 'Type', 'Version', 'Ersatz', 'Recycling', 'Batterie', 'Battery', 'Produkt', 'Product', 'Seite', 'Page', 'Datum', 'Date', 'Stand', 'Status'].includes(w));
      if (longWords.length > 0) {
        console.log(`✓ Hersteller (Heuristik): ${longWords[0]}`);
        return longWords[0];
      }
    }

    // Strategie 5: Erste nicht-leere Zeile des Dokuments (Deckblatt-Logik)
    const PDF_KW = /^(?:seite|page|datum|date|version|revision|stream|endstream|endobj|obj|xref|trailer|startxref|%%eof)\b/i;
    const firstLines = text.split('\n').map(l => l.trim()).filter(l => l.length > 3 && l.length < 80 && /[a-zA-ZäöüÄÖÜ]/.test(l) && !PDF_KW.test(l));
    if (firstLines.length > 0) {
      console.log(`✓ Hersteller (erste Zeile): ${firstLines[0]}`);
      return firstLines[0];
    }

    console.log('❌ Hersteller nicht gefunden');
    return '';
  }

  private extractBatteryCapacity(text: string): number {
    // Strategie 1: Explizite kWh/mWh/Wh Muster mit verschiedenen Schreibweisen
    const patterns = [
      { regex: /(\d+(?:[.,]\d+)?)\s*(?:kwh|kw\s?h|kWh|KWH)/i, factor: 1 },
      { regex: /(\d+(?:[.,]\d+)?)\s*(?:mwh|mw\s?h|mWh|MWH)/i, factor: 0.001 },
      { regex: /(\d+(?:[.,]\d+)?)\s*(?:wh|w\s?h|Wh|WH)(?!\s*h)/i, factor: 0.001 },
      { regex: /(?:kapazität|capacity|leistung|power)[\s:=]*(\d+(?:[.,]\d+)?)\s*(?:kwh|kwhm|kw|k)?/i, factor: 1 },
      // Flexiblere Batterie-Kontext-Suche
      { regex: /(?:batterie|akku|battery|zelle)\s*\(?(\d+(?:[.,]\d+)?)\s*(?:kwh)?/i, factor: 1 },
      // ISO/Zertifikat-Format: Zahlenfolge vor kWh
      { regex: /\b(\d{1,4}(?:[.,]\d{1,3})?)\s*(?:kwh|kw\s?h)/i, factor: 1 },
      // Bereichs-Angaben (z.B. "50-100 kWh") - nimm Durchschnitt oder höheren Wert
      { regex: /\b(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)\s*(?:kwh|kWh)/i, factor: 1 },
    ];

    for (const { regex, factor } of patterns) {
      const match = text.match(regex);
      if (match?.[1]) {
        // Für Bereichs-Angaben: verwende den Durchschnitt oder höheren Wert
        if (match[2]) {
          const val1 = parseFloat(match[1].replace(',', '.')) * factor;
          const val2 = parseFloat(match[2].replace(',', '.')) * factor;
          const value = (val1 + val2) / 2;  // Durchschnitt
          if (value > 0.1 && value < 10000) {
            console.log(`✓ Kapazität (Bereich): ${value} kWh (${val1}-${val2})`);
            return value;
          }
        } else {
          const value = parseFloat(match[1].replace(',', '.')) * factor;
          // Validiere plausible Werte für Batterien (0,1 bis 10000 kWh)
          if (value > 0.1 && value < 10000) {
            console.log(`✓ Kapazität (Pattern): ${value} kWh`);
            return value;
          }
        }
      }
    }

    // Strategie 2: Intelligente Heuristik - suche nach strukturierten Angaben
    // z.B. "Kapazität: 100 kWh" in verschiedenen Formaten
    const contextPlus = [
      /(?:kapazität|capacity|nominal|nennkapazität)[\s:=]*(\d{1,4})[\s]*(?:kwh|kwhm)?/i,
      /(?:^|\n)(\d{2,4})\s*kwh/i,  // Anfang einer Zeile mit xxx kWh
    ];

    for (const pattern of contextPlus) {
      const match = text.match(pattern);
      if (match?.[1]) {
        const value = parseFloat(match[1]);
        if (value > 10 && value < 10000) {
          console.log(`✓ Kapazität (Kontext): ${value} kWh`);
          return value;
        }
      }
    }

    // Strategie 3: Fallback - suche nach isolierten Zahlen in Batterie-Kontext
    const numberMatches = text.match(/\b(\d{2,4})\b/g) || [];
    for (const numStr of numberMatches) {
      const num = parseFloat(numStr);
      if (num > 30 && num < 500) {  // Typische Batterie-Größen
        // Kontrolliere, ob "kWh" oder "Kapazität" in der Nähe steht
        const context = text.substring(Math.max(0, text.indexOf(numStr) - 50), text.indexOf(numStr) + 50);
        if (context.match(/(?:kwh|kapazit|capacity|battery)/i)) {
          console.log(`✓ Kapazität (Heuristik): ${num} kWh`);
          return num;
        }
      }
    }

    console.log('❌ Kapazität nicht gefunden');
    return 0;
  }

  private extractBatteryChemistry(text: string): string {
    const chemistries = [
      // LiFePO4 Varianten (umfassend)
      { name: 'LiFePO4', keywords: ['lifepo4', 'lfp', 'lifepo', 'life po4', 'lfe', 'iron phosphate'] },
      // NMC/NCM Varianten
      { name: 'NMC', keywords: ['nmc', 'ncm', 'nickel mangan cobalt', 'nickel-manganese'] },
      // NCA Varianten
      { name: 'NCA', keywords: ['nca', 'nickel cobalt aluminum', 'nickel-cobalt-aluminum'] },
      // LCO (Lithium Cobalt Oxide)
      { name: 'LCO', keywords: ['lco', 'lithium cobalt oxide', 'cobalt oxide'] },
      // Allgemeine Lithium-Ionen
      { name: 'Lithium-Ionen', keywords: ['lithium-ion', 'lithium ion', 'li-ion', 'li ion', 'li-polymer', 'lipo'] },
      // Blei-Säure/Lead-Acid
      { name: 'Blei-Säure', keywords: ['lead acid', 'blei', 'säure', 'pb'] },
      // Nickel-Metall-Hydrid
      { name: 'Nickel-Metall-Hydrid', keywords: ['nimh', 'ni-mh', 'nickel metal hydride'] },
      // Natrium-Ionen (neue Technologie)
      { name: 'Natrium-Ionen', keywords: ['sodium ion', 'na-ion', 'natrium'] },
      // Fest-Elektrolyt
      { name: 'Fest-Elektrolyt', keywords: ['solid state', 'solid-state', 'festelektrolyt'] },
    ];

    const lowerText = text.toLowerCase();
    
    // Strategie 1: Kontext-basierte Keyword-Suche mit längerer Priorität
    for (const chem of chemistries) {
      for (const keyword of chem.keywords) {
        if (lowerText.includes(keyword)) {
          console.log(`✓ Chemisches System (Liste): ${chem.name}`);
          return chem.name;
        }
      }
    }

    // Strategie 2: Suche nach Chemie-Codes (vier-Buchstaben-Codes)
    const chemCodes = ['LFP', 'NCM', 'NMC', 'NCA', 'LCO', 'LMO'];
    for (const code of chemCodes) {
      if (lowerText.includes(code.toLowerCase())) {
        console.log(`✓ Chemisches System (Code): ${code}`);
        return code;
      }
    }

    // Strategie 3: Suche nach Chemie-Keywords in bestimmten Kontexten
    const contextPatterns = [
      /(?:chemistry|chemie|cell chemistry|elektrolyt)[\s:]*([^\n,;]{5,40})/i,
      /(?:type|typ)\s*[=:]\s*([a-z\d\s\-]+?)\s*(?:\n|,|;|battery)/i,
    ];

    for (const pattern of contextPatterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        const candidate = match[1].trim();
        // Validiere, dass es eine bekannte Chemie enthält
        for (const chem of chemistries) {
          for (const keyword of chem.keywords) {
            if (candidate.toLowerCase().includes(keyword)) {
              console.log(`✓ Chemisches System (Kontext): ${chem.name}`);
              return chem.name;
            }
          }
        }
      }
    }

    console.log('❌ Chemisches System nicht gefunden');
    return '';
  }

  private extractTextileData(pdfText: string): AIExtractionOutput {
    console.log('👕 Extrahiere Textile-Produktdaten...');

    const hersteller = this.extractTextileManufacturer(pdfText);
    const modellname = this.extractProductModel(pdfText);
    const materialZusammensetzung = this.extractMaterial(pdfText);
    const herkunftsland = this.extractOriginCountry(pdfText);

    const missingFields = [];
    if (!hersteller) missingFields.push('Hersteller');
    if (!modellname) missingFields.push('Modellname');
    if (!materialZusammensetzung) missingFields.push('Material');
    if (!herkunftsland) missingFields.push('Herkunftsland');

    const confidence = (4 - missingFields.length) / 4;

    const result: AIExtractionOutput = {
      productType: 'TEXTILE',
      confidence,
      extractedFields: {
        type: 'TEXTILE',
        hersteller: hersteller || '',
        modellname: modellname || '',
        materialZusammensetzung: materialZusammensetzung || '',
        herkunftsland: herkunftsland || '',
      } as any,
      warnings: missingFields.length > 0
        ? [`Fehlende Felder: ${missingFields.join(', ')}`]
        : [],
    };

    console.log('✅ Textile: ', {
      hersteller: (result.extractedFields as any).hersteller,
      modellname: (result.extractedFields as any).modellname,
      material: (result.extractedFields as any).materialZusammensetzung,
      confidence: confidence.toFixed(2),
    });

    return result;
  }

  private extractTextileManufacturer(text: string): string {
    const patterns = [
      /(?:manufacturer|maker|brand|hersteller)[\s:]*([a-zA-Z &\-]+?)(?:\n|,|;|$)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        const result = match[1].trim();
        if (result.length > 2 && result.length < 50) {
          console.log(`✓ Hersteller (Pattern): ${result}`);
          return result;
        }
      }
    }

    const brands = ['Adidas', 'Nike', 'Puma', 'H&M', 'Zara'];
    const lowerText = text.toLowerCase();
    for (const brand of brands) {
      if (lowerText.includes(brand.toLowerCase())) {
        console.log(`✓ Hersteller (Liste): ${brand}`);
        return brand;
      }
    }

    console.log('❌ Hersteller nicht gefunden');
    return '';
  }

  private extractMaterial(text: string): string {
    const materialPattern = /([0-9]{1,3}%\s*[a-zA-Z\s]+(?:\s*,?\s*[0-9]{1,3}%\s*[a-zA-Z\s]+)*)/i;
    const match = text.match(materialPattern);

    if (match?.[1]) {
      const result = match[1].trim();
      console.log(`✓ Material: ${result}`);
      return result;
    }

    console.log('❌ Material nicht gefunden');
    return '';
  }

  private extractOriginCountry(text: string): string {
    const patterns = [
      /(?:made in|hergestellt in|country)[\s:]*([a-z]{2})/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        const code = match[1].toUpperCase();
        console.log(`✓ Herkunftsland: ${code}`);
        return code;
      }
    }

    console.log('❌ Herkunftsland nicht gefunden');
    return '';
  }

  private extractProductModel(text: string): string {
    // Strategie 1: Kontext-basierte Extraktion.
    // Lookahead stoppt vor dem nächsten "Label:" Muster (z.B. "Seriennummer:", "Herstellungsdatum:")
    const contextPatterns = [
      /(?:modellname|produktname|product name|modell|model)[\s:]+([^\n,;]+?)(?=\s+[A-ZÄÖÜ][a-zäöü][a-zA-ZäöüÄÖÜß\s\-]*\s*:|\n|,|;|$)/i,
      /(?:product|batterie)[\s:]+([^\n,;]+?)(?=\s+[A-ZÄÖÜ][a-zäöü][a-zA-ZäöüÄÖÜß\s\-]*\s*:|\n|@|—|\d{4,}|$)/i,
      // Suche nach Muster mit bekannten Model-Qualifizierern (Pro, Plus, Max, Standard, etc.)
      /\b([A-Z][a-zA-Z0-9\s\-]{3,50}?(?:Pro|Plus|Max|Standard|X|T|S|SE|XL|L|M|TL|GT)\b[0-9A-Z\-\d]*)\b/i,
      // Allgemeines Muster: Großbuchstabe + alphanumerisch + Zahlen (z.B. PowerCell Pro T100)
      /\b([A-Z][a-zA-Z\s]*\d{2,4}[A-Z]*)\b/,
    ];

    for (const pattern of contextPatterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        const candidate = match[1].trim();
        // Validiere: Länge 2-100, nicht nur Zahlen/Buchstaben-Abkürzungen
        if (candidate.length > 2 && candidate.length < 100 && !/^[a-z]{1,2}$/.test(candidate)) {
          // Entferne häufige Suffixe, die nicht Teil des Modellnamens sind
          const cleaned = candidate
            .replace(/\s+(by|von|—|made|from|manufacturer|hersteller).*$/i, '')
            .replace(/\s+\d{3,5}(?:kwh|kg|g|°C|%|v).*$/i, '')
            .trim();
          
          if (cleaned.length > 2 && cleaned.length < 100) {
            console.log(`✓ Modellname (Kontext): ${cleaned}`);
            return cleaned;
          }
        }
      }
    }

    // Strategie 2: Bekannte Batterie- und Produktserien-Keywords
    const knownModels = [
      // Tesla
      { pattern: /model\s+3|model 3/i, name: 'Model 3' },
      { pattern: /model\s+s|model s/i, name: 'Model S' },
      { pattern: /model\s+x|model x/i, name: 'Model X' },
      { pattern: /model\s+y|model y/i, name: 'Model Y' },
      // BMW
      { pattern: /bmw\s+i\d|iX|i3|i4|i7/i, name: 'BMW i-Serie' },
      // VW
      { pattern: /id\.\d|id\s+buzz|id\s+3|id\s+4|id\s+5/i, name: 'ID-Serie' },
      // Battery-spezifische Modelle
      { pattern: /powercell\s+pro/i, name: 'PowerCell Pro' },
      { pattern: /lifepo4|lfp/i, name: 'LiFePO4' },
      // Allgemeine Tesla/BMW/Audi-Muster
      { pattern: /e[a-z]*\d{2,3}|e-golf|e-tron/i, name: 'e-Modell' },
    ];

    for (const { pattern, name } of knownModels) {
      if (pattern.test(text)) {
        console.log(`✓ Modellname (Liste): ${name}`);
        return name;
      }
    }

    // Strategie 3: Suche nach strukturierten Modellnamen - Muster mit Leerzeichen
    // z.B. "PowerCell Pro T100", "Model X Plus" etc.
    const structuredPatterns = [
      // Wort + Wort + Zahlen (z.B. "PowerCell Pro T100")
      /\b([A-Z][a-z]+\s+[A-Z][a-z]+\s+[A-Z]\d{2,4})\b/,
      // Wort + (Pro|Plus|Standard) + Zahlen
      /\b([A-Z][a-z]+\s+(?:Pro|Plus|Standard|Max|X|GT|SE|XL)\s*[\dT]*\d*)\b/i,
      // Wort + Zahlen (z.B. "Model 3", "3008")
      /\b([A-Z][a-z]*\s+\d{3,4}[A-Z]*)\b/,
    ];

    for (const pattern of structuredPatterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        const candidate = match[1].trim();
        if (candidate.length > 2 && candidate.length < 50 && !/^[0-9]+$/.test(candidate)) {
          console.log(`✓ Modellname (Struktur): ${candidate}`);
          return candidate;
        }
      }
    }

    // Strategie 4: Fallback auf längere Zahlenkombinationen
    // Wichtig: Priorisiere längere Matches über kurze Ein-/Zwei-Buchstaben-Codes
    const numberPatterns = [
      /\b([A-Z]{1,3}\d{3,4}[A-Z]?)\b/,   // z.B. "T100", "S3008"
      /\b(\d{3,4}[A-Z]{1,2})\b/,         // z.B. "3008X", "5008S"
      /\b([A-Z][a-z]+\d{2,4})\b/,        // z.B. "Model3", "S8"
    ];

    for (const pattern of numberPatterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        const candidate = match[1].trim();
        if (candidate.length > 1 && candidate.length < 30 && 
            !/^[a-z]{1,2}$/.test(candidate) && 
            candidate !== 'q' &&
            !candidate.match(/^[0-9]{1,2}$/)) {  // Keine Ein-/zwei-stelligen Zahlen
          console.log(`✓ Modellname (Zahlen): ${candidate}`);
          return candidate;
        }
      }
    }

    // Strategie 5: Zweite nicht-leere Zeile des Dokuments als letzter Ausweg
    const PDF_KW2 = /^(?:seite|page|datum|date|version|revision|stream|endstream|endobj|obj|xref|trailer|startxref|%%eof)\b/i;
    const meaningfulLines = text.split('\n').map(l => l.trim()).filter(l => l.length > 3 && l.length < 80 && /[a-zA-ZäöüÄÖÜ]/.test(l) && !PDF_KW2.test(l));
    if (meaningfulLines.length > 1) {
      console.log(`✓ Modellname (zweite Zeile): ${meaningfulLines[1]}`);
      return meaningfulLines[1];
    } else if (meaningfulLines.length === 1) {
      console.log(`✓ Modellname (erste Zeile): ${meaningfulLines[0]}`);
      return meaningfulLines[0];
    }

    console.log('❌ Modellname nicht gefunden');
    return '';
  }

  // ===== ESPR-SPEZIFISCHE EXTRAKTIONS-METHODEN =====

  private extractBatteryType(text: string): string {
    // Batterietyp Patterns (z.B. Lithium-Ionen, LiFePO4, etc.)
    const patterns = [
      /(?:batterietyp|battery type|typ)[\s:]*([^,\n]+)/i,
      /(Lithium[^,\n]*|Blei[^,\n]*|Nickel[^,\n]*)/,
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        const result = match[1].trim().substring(0, 100);
        console.log(`✓ Batterietyp: ${result}`);
        return result;
      }
    }
    return '';
  }

  private extractProductionDate(text: string): Date | undefined {
    const patterns = [
      /(?:produktionsdatum|herstellungsdatum|production date|manufacturing date|manufact(?:ured|uring) date)[\s:]*(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{4})/i,
      /(\d{4})-(\d{2})-(\d{2})/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        try {
          const dateStr = match[1];
          // Handle German DD.MM.YYYY format
          const parts = dateStr.split(/[.\/-]/);
          if (parts.length === 3) {
            let year: number, month: number, day: number;
            if (parseInt(parts[0]) > 1000) {
              [year, month, day] = parts.map(Number); // YYYY-MM-DD
            } else {
              [day, month, year] = parts.map(Number); // DD.MM.YYYY
            }
            const parsed = new Date(year, month - 1, day);
            if (!isNaN(parsed.getTime())) {
              console.log(`✓ Produktionsdatum: ${parsed.toLocaleDateString('de-DE')}`);
              return parsed;
            }
          }
        } catch (e) {
          // Ignorieren und weitermachen
        }
      }
    }
    return undefined;
  }

  private parseGermanNumber(str: string): number {
    // "24.500" (thousands sep) → 24500, "24,5" (decimal) → 24.5, "1.234,56" → 1234.56
    if (/^\d{1,3}(\.\d{3})+$/.test(str)) return parseFloat(str.replace(/\./g, ''));
    if (str.includes(',') && !str.includes('.')) return parseFloat(str.replace(',', '.'));
    if (str.includes('.') && str.includes(',')) return parseFloat(str.replace(/\./g, '').replace(',', '.'));
    return parseFloat(str);
  }

  private extractCO2Footprint(text: string): number | undefined {
    // CO2-Fußabdruck per kWh — "450 kg CO2e pro kWh" or "450 kg CO2e / kWh"
    const patterns = [
      /([0-9][0-9.,]*)\s*(?:kg\s*)?co2(?:e)?\s*(?:pro|per|\/)\s*kwh/i,
      /co2[\w\s\-]*(?:pro|per|\/)\s*kwh[\s:]*([0-9][0-9.,]*)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        const value = this.parseGermanNumber(match[1]);
        if (value > 0 && value < 100000) {
          console.log(`✓ CO2-Fußabdruck/kWh: ${value}`);
          return value;
        }
      }
    }
    return undefined;
  }

  private extractCO2Total(text: string): number | undefined {
    // Gesamt-CO2-Fußabdruck — e.g. "24.500 kg CO2e (Cradle-to-Gate)"
    const patterns = [
      /co2[\w\s\-]*(?:fußabdruck|footprint|fussabdruck)[\s:]*([0-9][0-9.,]*)\s*(?:kg|t(?:o[n])?)/i,
      /([0-9][0-9.,]*)\s*kg\s*co2e/i,
      /([0-9][0-9.,]*)\s*kg\s*co2(?!\s*e?\s*\/)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        const value = this.parseGermanNumber(match[1]);
        if (value > 0 && value < 10_000_000) {
          console.log(`✓ CO2 gesamt: ${value} kg CO2e`);
          return value;
        }
      }
    }
    return undefined;
  }

  private extractLifespan(text: string): number | undefined {
    // Lebensdauer Pattern (Ladezyklen) - mehrere Varianten
    const patterns = [
      // German thousands separator support: "5.000" or "5,000"
      /(?:lebensdauer|lifespan|lade?zyklen|cycles|cycle life)[\s:=]*(\d{1,3}(?:[.,]\d{3})*|\d+)/i,
      /(?:bis zu|up to|~|approximately|approx)\s*(\d{1,3}(?:[.,]\d{3})*|\d+)\s*(?:ladezyklen|cycles|cycle)/i,
      /(?:vollzyklus|full cycle|charge cycle)[\s:=]*(\d{1,3}(?:[.,]\d{3})*|\d+)/i,
      // Suche nach Zahlen gefolgt von "cycles" oder "Zyklen"
      /(\d{1,3}(?:[.,]\d{3})+|\d{3,5})\s*(?:load cycle|charge cycle|lade?zyklen|cycles)/i,
      // Kontextuell: "1000-2000" Zyklen
      /(\d{1,3}(?:[.,]\d{3})+|\d{4,5})\s*(?:lade?zyklen|full cycles)/i,
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        const value = this.parseGermanNumber(match[1]);
        if (value > 100 && value < 100000) {
          console.log(`✓ Erwartete Lebensdauer: ${value} Ladezyklen`);
          return value;
        }
      }
    }

    // Strategie 2: Suche nach Bereichen (z.B. "1000-2000 cycles")
    const rangePattern = /(\d{3,5})\s*-\s*(\d{3,5})\s*(?:cycle|zyklus|cycles|zyklen)/i;
    const rangeMatch = text.match(rangePattern);
    if (rangeMatch?.[1]) {
      const val1 = parseInt(rangeMatch[1]);
      const val2 = parseInt(rangeMatch[2]);
      if (val1 > 100 && val2 < 100000) {
        const average = Math.round((val1 + val2) / 2);
        console.log(`✓ Lebensdauer (Bereich): ${average} Ladezyklen (${val1}-${val2})`);
        return average;
      }
    }

    // Strategie 3: Suche nach Kapazitäts-Erhaltung (z.B. "80% nach 1000 Zyklen")
    const retentionPattern = /(\d+)%\s*(?:after|nach|at|bei)\s*(\d{3,5})\s*(?:cycle|zyklus|cycles|zyklen)/i;
    const retentionMatch = text.match(retentionPattern);
    if (retentionMatch?.[2]) {
      const value = parseInt(retentionMatch[2]);
      if (value > 100 && value < 100000) {
        console.log(`✓ Lebensdauer (Retention): ${value} Ladezyklen`);
        return value;
      }
    }

    return undefined;
  }

  private extractRepairabilityIndex(text: string): number | undefined {
    // Reparierbarkeits-Index Pattern - sehr flexible Suche
    const patterns = [
      // Explizite Patterns mit verschiedenen Schreibweisen
      /(?:reparierbarkeit|reparierbarkeits|repairability)(?:[\-\s]+index)?[\s:=]*(\d+(?:[.,]\d+)?)\s*\/\s*10/i,
      /(?:reparierbarkeit|reparierbarkeits|repairability)-index[\s:=]*(\d+(?:[.,]\d+)?)/i,
      /reparierbarkeitsindex[\s:=]*(\d+(?:[.,]\d+)?)/i,
      /(?:repairability score|repair index|repair score)[\s:=]*(\d+(?:[.,]\d+)?)/i,
      // Zahlen zwischen 0 und 10 mit "Reparierbarkeit" Kontext
      /(?:reparierbarkeit|repairability)[\s:=]*(\d+(?:[.,]\d+)?)/i,
      // Score Format: "8.5/10" oder "8,5/10"
      /score[\s:=]*(\d+(?:[.,]\d+)?)\s*\/\s*10/i,
      // Verschiedene Sprachvarianten
      /(?:índice de reparabilidad|indice de reparabilite|repair score|maintenance index)[\s:=]*(\d+(?:[.,]\d+)?)/i,
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        const value = parseFloat(match[1].replace(',', '.'));
        if (value >= 0 && value <= 10) {
          console.log(`✓ Reparierbarkeits-Index: ${value} / 10`);
          return value;
        }
      }
    }

    // Strategie 2: Suche nach Wortmustern, die Score-Informationen enthalten
    const descriptivePattern = /(?:leicht |sehr |einfach |kompliziert |schwierig )?(?:zu reparieren|to repair|reparable)[\s:]*(\d+(?:[.,]\d+)?)/i;
    const descMatch = text.match(descriptivePattern);
    if (descMatch?.[1]) {
      const value = parseFloat(descMatch[1].replace(',', '.'));
      if (value >= 0 && value <= 10) {
        console.log(`✓ Reparierbarkeits-Index (Beschreibung): ${value} / 10`);
        return value;
      }
    }

    return undefined;
  }

  private extractSparePartsAvailability(text: string): number | undefined {
    // Verfügbarkeit von Ersatzteilen (Jahre) - sehr flexible Suche
    const patterns = [
      // "Verfügbarkeit von Ersatzteilen: 10 Jahre" (word order: availability first)
      /verfügbarkeit\s+von\s+ersatzteilen?[\s:]*(\d{1,3})\s*(?:jahre|years|jahr|year)/i,
      /(?:availability|verfügbarkeit)\s+(?:of|von)\s+(?:spare parts|ersatzteilen?)[\s:]*(\d{1,3})\s*(?:jahre|years|jahr|year)/i,
      // Explizite Muster mit verschiedenen Schreibweisen
      /(?:ersatzteile|spare parts|spareparts)[\s:]*(?:verfügbar|available)[\s:]*(\d{1,3})\s*(?:jahre|years|jahr|year)/i,
      /(?:ersatzteile|spare parts)[\s:]*(\d{1,3})\s*(?:jahre|years|jahr|year)/i,
      /(?:verfügbarkeit|availability)[\s:]*(?:der )?(?:ersatzteile|spare parts)[\s:]*(\d{1,3})\s*(?:jahre|years)/i,
      /(?:teil|part|spare)[\s:]*(?:verfügbarkeit|availability)[\s:]*(\d{1,3})\s*(?:jahren|years|jahr|year)/i,
      // Verschiedene Sprachvarianten
      /(?:disponibilidad de piezas|sparts disponibility|onderdelen beschikbaarheid)[\s:]*(\d{1,3})/i,
      // Zahlenangabe mit "years" oder "Jahre" für Teile
      /\b(\d{1,3})\s*(?:jahre|years)\s+(?:ersatzteile|spare parts)/i,
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        const value = parseInt(match[1]);
        if (value > 0 && value < 100) {
          console.log(`✓ Ersatzteile-Verfügbarkeit: ${value} Jahre`);
          return value;
        }
      }
    }

    // Strategie 2: Suche nach "bis zu", "up to" Patterns
    const upToPattern = /(?:bis zu|up to|up to|jusqu'à)\s*(\d{1,3})\s*(?:jahre|years|ans)/i;
    const upToMatch = text.match(upToPattern);
    if (upToMatch?.[1]) {
      // Kontrolliere, ob es um Ersatzteile im Kontext geht
      const context = text.substring(Math.max(0, text.indexOf(upToMatch[0]) - 100), text.indexOf(upToMatch[0]) + 100);
      if (context.match(/(?:ersatzteile|spare|parts|piece)/i)) {
        const value = parseInt(upToMatch[1]);
        if (value > 0 && value < 100) {
          console.log(`✓ Ersatzteile-Verfügbarkeit (bis zu): ${value} Jahre`);
          return value;
        }
      }
    }

    // Strategie 3: Suche nach Garantie-ähnlichen Angaben (diese können mit Teilen-Verfügbarkeit gleich sein)
    const warrantyPattern = /(?:garantie|warranty|support)[\s:]*(\d{1,3})\s*(?:jahre|years|hart|month|monate)/i;
    const warrantyMatch = text.match(warrantyPattern);
    if (warrantyMatch?.[1]) {
      const context = text.substring(Math.max(0, text.indexOf(warrantyMatch[0]) - 50), text.indexOf(warrantyMatch[0]) + 50);
      if (context.match(/ersatzteile|spare/i)) {
        const value = parseInt(warrantyMatch[1]);
        if (value > 0 && value < 100) {
          console.log(`✓ Ersatzteile-Verfügbarkeit (Garantie): ${value} Jahre`);
          return value;
        }
      }
    }

    return undefined;
  }

  private extractRecyclingShare(text: string, material: string): number | undefined {
    // Patterns: "Kobalt (15%)", "Kobalt: 15 %", "Recycling-Anteil Lithium: 12.5 %"
    // Note: char class includes ( so " (" is handled
    const patterns = [
      new RegExp(`recycling[\\w\\s\\-]*${material}[\\s:)(]*([\\d.,]+)\\s*%`, 'i'),
      new RegExp(`${material}[\\s:)(]*([\\d.,]+)\\s*%`, 'i'),
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        const value = parseFloat(match[1].replace(',', '.'));
        if (value >= 0 && value <= 100) {
          console.log(`✓ Recyclinganteil ${material}: ${value}%`);
          return value;
        }
      }
    }
    return undefined;
  }

  private extractRecyclingInstructions(text: string): string | undefined {
    // Recycling-Anweisungen Pattern
    const patterns = [
      /(?:recycling|entsorgung|disposal)[\s:-]*anweisungen?[\s:]*([^\n]{10,200})/i,
      /(?:recycling|entsorgung)[\s:]*([^.!?\n]{20,150}(?:EU|sammelstellen)(?:[^.!?\n])*)/i,
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        const result = match[1].trim().substring(0, 200);
        console.log(`✓ Recycling-Anweisungen: ${result.substring(0, 50)}...`);
        return result;
      }
    }
    return undefined;
  }

  private extractSerialNumber(text: string): string | undefined {
    const match = text.match(/(?:seriennummer|serial\s*number|serial\s*no\.?)[\s:]+([A-Z0-9\-]+)/i);
    if (match?.[1]) {
      console.log(`✓ Seriennummer: ${match[1]}`);
      return match[1].trim();
    }
    return undefined;
  }

  private extractVoltage(text: string): number | undefined {
    const patterns = [
      /(?:nennspannung|nominal voltage|spannung|voltage)[\s:]*([0-9][0-9.,]*)\s*[Vv]\b/i,
      /([0-9]+)\s*[Vv]\b(?:\s*(?:nominal|Nenn))/i,
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        const value = this.parseGermanNumber(match[1]);
        if (value > 0 && value < 100000) {
          console.log(`✓ Nennspannung: ${value} V`);
          return value;
        }
      }
    }
    return undefined;
  }

  private extractWeightKg(text: string): number | undefined {
    const patterns = [
      /(?:gewicht|weight|masse|mass)[\s:]*([0-9][0-9.,]*)\s*kg\b/i,
      /([0-9][0-9.,]*)\s*kg\b(?![Wh\/])/i,
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        const value = this.parseGermanNumber(match[1]);
        if (value > 0 && value < 100000) {
          console.log(`✓ Gewicht: ${value} kg`);
          return value;
        }
      }
    }
    return undefined;
  }

  private extractCertificationBody(text: string): string | undefined {
    const match = text.match(/(?:zertifizierungsstelle|certification body|certifying authority)[\s:]+([^\n.]+)/i);
    if (match?.[1]) {
      console.log(`✓ Zertifizierungsstelle: ${match[1].trim()}`);
      return match[1].trim();
    }
    return undefined;
  }

  private extractReferenceNumber(text: string): string | undefined {
    const match = text.match(/(?:referenznummer|reference\s*(?:no\.?|number)|ref\.?\s*nr\.?)[\s:]+([A-Z0-9\-]+)/i);
    if (match?.[1]) {
      console.log(`✓ Referenznummer: ${match[1]}`);
      return match[1].trim();
    }
    return undefined;
  }

  private extractLegalNotes(text: string): string | undefined {
    const match = text.match(/(?:rechtliche\s*hinweise|legal\s*notes?|rechtlicher\s*hinweis)[\s:\n]+([^\n]{20,300})/i);
    if (match?.[1]) {
      const note = match[1].trim().substring(0, 300);
      console.log(`✓ Rechtliche Hinweise: ${note.substring(0, 50)}...`);
      return note;
    }
    return undefined;
  }

  private extractElectronicsData(pdfText: string): AIExtractionOutput {
    console.log('🖥️  Extrahiere Elektronik-Produktdaten...');

    const hersteller = this.extractBatteryManufacturer(pdfText); // Nutze gleiche Hersteller-Logik
    const modellname = this.extractProductModel(pdfText); // Nutze gleiche Modell-Logik
    const stromverbrauch = this.extractNumberFromContext(pdfText, 'stromverbrauch|power consumption|watt|w');
    const energieeffizienzklasse = this.extractEnergyClass(pdfText);

    const missingFields = [];
    if (!hersteller) missingFields.push('Hersteller');
    if (!modellname) missingFields.push('Modellname');

    const confidence = (2 - missingFields.length) / 2;

    return {
      productType: 'ELECTRONICS',
      confidence,
      extractedFields: {
        type: 'ELECTRONICS',
        hersteller: hersteller || '',
        modellname: modellname || '',
        ...(stromverbrauch && { stromverbrauch }),
        ...(energieeffizienzklasse && { energieeffizienzklasse }),
      } as any,
      warnings: [],
    };
  }

  private extractFurnitureData(pdfText: string): AIExtractionOutput {
    console.log('🪑 Extrahiere Möbel-Produktdaten...');

    const hersteller = this.extractBatteryManufacturer(pdfText);
    const modellname = this.extractProductModel(pdfText);
    const material = this.extractMaterial(pdfText);

    return {
      productType: 'FURNITURE',
      confidence: 0.6,
      extractedFields: {
        type: 'FURNITURE',
        hersteller: hersteller || '',
        modellname: modellname || '',
        ...(material && { material }),
      } as any,
      warnings: [],
    };
  }

  private extractChemicalData(pdfText: string): AIExtractionOutput {
    console.log('⚗️  Extrahiere Chemikalien-Produktdaten...');

    const hersteller = this.extractBatteryManufacturer(pdfText);
    const modellname = this.extractProductModel(pdfText);
    const gefahrenstoffe = this.extractHazards(pdfText);

    return {
      productType: 'CHEMICAL',
      confidence: 0.5,
      extractedFields: {
        type: 'CHEMICAL',
        hersteller: hersteller || '',
        modellname: modellname || '',
        ...(gefahrenstoffe.length > 0 && { gefahrenstoffe }),
      } as any,
      warnings: gefahrenstoffe.length > 0 ? [`Enthält Gefahrenstoffe: ${gefahrenstoffe.join(', ')}`] : [],
    };
  }

  private extractGenericData(pdfText: string, detectedType?: string): AIExtractionOutput {
    console.log('❓ Extrahiere generische Produktdaten...');

    const hersteller = this.extractBatteryManufacturer(pdfText);
    const modellname = this.extractProductModel(pdfText);

    // Extrahiere alle Zahlen und Werte als generische Felder
    const additionalFields: any = {};
    
    // Suche nach Zahlen-Wert-Paaren
    const numberPattern = /([a-z]+)[\s:=]*(\d+(?:[.,]\d+)?)\s*([a-z%°c]*)/gi;
    let match;
    const seen = new Set<string>();
    
    while ((match = numberPattern.exec(pdfText)) !== null) {
      const key = match[1].trim().toLowerCase().replace(/\s+/g, '_');
      if (!seen.has(key) && key.length > 2 && key.length < 30) {
        additionalFields[key] = match[2];
        seen.add(key);
      }
    }

    return {
      productType: detectedType as any || 'OTHER',
      confidence: 0.4,
      extractedFields: {
        type: detectedType || 'OTHER',
        hersteller: hersteller || '',
        modellname: modellname || '',
        ...additionalFields,
      } as any,
      warnings: [`Produkttyp unbekannt oder generisch. Daten könnten unvollständig sein.`],
    };
  }

  // ===== HILFSMETHODEN FÜR WEITERE PRODUKTTYPEN =====

  private extractNumberFromContext(text: string, contextPattern: string): number | undefined {
    const pattern = new RegExp(`${contextPattern}[\\s:=]*(\\d+(?:[.,]\\d+)?)`, 'i');
    const match = text.match(pattern);
    if (match?.[1]) {
      return parseFloat(match[1].replace(',', '.'));
    }
    return undefined;
  }

  private extractEnergyClass(text: string): string | undefined {
    const pattern = /(?:energieeffizienz|energy|effizienz)[\s:]*([A-G](?:\+)?)/i;
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
    return undefined;
  }

  private extractHazards(text: string): string[] {
    const hazards: string[] = [];
    const hazardKeywords = [
      { key: 'giftig', names: ['Giftig', 'Toxisch'] },
      { key: 'ätzend', names: ['Ätzend'] },
      { key: 'explosiv', names: ['Explosiv'] },
      { key: 'brennbar', names: ['Brennbar', 'Flammable'] },
      { key: 'oxidierend', names: ['Oxidierend'] },
      { key: 'umwelt', names: ['Umweltschädlich'] },
    ];

    const lowerText = text.toLowerCase();
    for (const hazard of hazardKeywords) {
      if (lowerText.includes(hazard.key)) {
        hazards.push(...hazard.names);
      }
    }

    return [...new Set(hazards)]; // Entferne Duplikate
  }

  async validateField(
    _fieldName: string,
    _value: unknown,
    _productType: ProductPassport['type']
  ): Promise<boolean> {
    return true;
  }

  async suggestAlternatives(
    _message: string,
    _context: Partial<ProductPassport>
  ): Promise<string[]> {
    return [];
  }
}
