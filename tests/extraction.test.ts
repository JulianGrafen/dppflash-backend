/**
 * Unit tests for localExtractionService and qrCodeService.
 *
 * Run:  npx vitest run
 */

import { describe, it, expect } from 'vitest';
import { BatteryRegexExtractor } from '../app/services/localExtractionService';
import { generateQRCode } from '../app/services/qrCodeService';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Typical German battery datasheet text (after PDF cleaning) */
const DE_BATTERY = `
TechVolt GmbH
PowerCell Pro T100

Hersteller: TechVolt GmbH
Modellname: PowerCell Pro T100
Seriennummer: SN-2024-001
Herstellungsdatum: 15.03.2024
Kapazität: 100 kWh
Chemisches System: NMC (Nickel-Mangan-Cobalt)
Batterietyp: Stationär
Nennspannung: 700 V
Gewicht: 650 kg

CO2-Fußabdruck: 24.500 kg CO2e (Cradle-to-Gate)
CO2 pro kWh: 245 kg CO2e/kWh

Recyclinganteil Kobalt: 16%
Recyclinganteil Lithium: 4%
Recyclinganteil Nickel: 6%

Erwartete Lebensdauer: 5.000 Ladezyklen
Reparierbarkeitsindex: 7.5/10
Verfügbarkeit von Ersatzteilen: 10 Jahre
Garantie: 8 Jahre

Recyclinganweisungen: Rückgabe beim autorisierten Händler
Zertifizierungsstelle: TÜV Rheinland
Regulatorische Referenz: EU 2023/1542
Rechtliche Hinweise: Dieses Produkt entspricht allen EU-Vorschriften.
`;

/** Typical English battery datasheet text */
const EN_BATTERY = `
Manufacturer: Acme Battery Inc.
Model Name: UltraCell 500
Capacity: 75 kWh
Chemistry: LiFePO4
Battery type: EV
Nominal voltage: 400 V
Weight: 350 kg

CO2 footprint: 18000 kg CO2e
CO2 per kWh: 240 kg CO2e/kWh

Recycled content Cobalt: 20%
Recycled content Lithium: 8%

Expected lifecycle: 4000 cycles
Repairability score: 8/10
Spare parts availability: 12 years
Warranty: 5 years

Certification body: Bureau Veritas
`;

// ─── German extraction ────────────────────────────────────────────────────────

describe('BatteryRegexExtractor — German input', () => {
  const extractor = new BatteryRegexExtractor();
  let result: ReturnType<typeof extractor.extract>;

  // Extract once and reuse across all it() blocks
  result = extractor.extract(DE_BATTERY);

  it('extracts manufacturer name', () => {
    expect(result.manufacturer?.name).toBe('TechVolt GmbH');
    expect(result.hersteller).toBe('TechVolt GmbH');
  });

  it('extracts model name (flat + nested)', () => {
    expect(result.model).toBe('PowerCell Pro T100');
    expect(result.modellname).toBe('PowerCell Pro T100');
  });

  it('extracts serial number', () => {
    expect(result.serialNumber).toBe('SN-2024-001');
  });

  it('parses production date to ISO format', () => {
    expect(result.productionDate).toBe('2024-03-15');
  });

  it('extracts capacity in kWh', () => {
    expect(result.capacityKwh).toBe(100);
  });

  it('identifies NMC chemistry', () => {
    expect(result.chemistry).toContain('NMC');
  });

  it('extracts battery type', () => {
    expect(result.batteryType?.toLowerCase()).toContain('stationär');
  });

  it('parses nominal voltage', () => {
    expect(result.nominalVoltageV).toBe(700);
  });

  it('parses weight in kg', () => {
    expect(result.weightKg).toBe(650);
  });

  it('parses total CO2 (German thousands separator "24.500" → 24500)', () => {
    expect(result.carbonFootprint?.totalKg).toBe(24500);
  });

  it('parses CO2 per kWh', () => {
    expect(result.carbonFootprint?.perKwhKg).toBe(245);
  });

  it('extracts cobalt recycled %', () => {
    expect(result.recycledContent?.cobaltPct).toBe(16);
  });

  it('extracts lithium recycled %', () => {
    expect(result.recycledContent?.lithiumPct).toBe(4);
  });

  it('extracts nickel recycled %', () => {
    expect(result.recycledContent?.nickelPct).toBe(6);
  });

  it('parses expected lifecycle cycles (German "5.000" → 5000)', () => {
    expect(result.lifecycle?.expectedCycles).toBe(5000);
  });

  it('parses repairability score (7.5/10)', () => {
    expect(result.lifecycle?.repairabilityScore).toBe(7.5);
  });

  it('parses spare parts availability', () => {
    expect(result.lifecycle?.sparePartsAvailableYears).toBe(10);
  });

  it('parses warranty years', () => {
    expect(result.lifecycle?.warrantyYears).toBe(8);
  });

  it('extracts certification body', () => {
    expect(result.certificationBody).toContain('TÜV Rheinland');
  });

  it('extracts recycling instructions', () => {
    expect(result.endOfLife?.recyclingInstructions).toBeTruthy();
  });
});

// ─── English extraction ───────────────────────────────────────────────────────

describe('BatteryRegexExtractor — English input', () => {
  const extractor = new BatteryRegexExtractor();
  const r = extractor.extract(EN_BATTERY);

  it('extracts English manufacturer', () => {
    expect(r.manufacturer?.name).toBe('Acme Battery Inc.');
  });

  it('extracts English model', () => {
    expect(r.model).toContain('UltraCell 500');
  });

  it('extracts capacity (75 kWh)', () => {
    expect(r.capacityKwh).toBe(75);
  });

  it('detects LiFePO4 chemistry', () => {
    expect(r.chemistry).toBe('LiFePO4 (LFP)');
  });

  it('extracts total CO2 footprint', () => {
    expect(r.carbonFootprint?.totalKg).toBe(18000);
  });

  it('extracts cobalt recycled %', () => {
    expect(r.recycledContent?.cobaltPct).toBe(20);
  });

  it('parses expected lifecycle (4000 cycles)', () => {
    expect(r.lifecycle?.expectedCycles).toBe(4000);
  });

  it('parses repairability score (8/10)', () => {
    expect(r.lifecycle?.repairabilityScore).toBe(8);
  });

  it('parses spare parts availability (12 years)', () => {
    expect(r.lifecycle?.sparePartsAvailableYears).toBe(12);
  });

  it('extracts Bureau Veritas as certification body', () => {
    expect(r.certificationBody).toContain('Bureau Veritas');
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('BatteryRegexExtractor — edge cases', () => {
  const extractor = new BatteryRegexExtractor();

  it('returns empty strings (not undefined) for hersteller and modellname on blank input', () => {
    const r = extractor.extract('');
    expect(r.hersteller).toBe('');
    expect(r.modellname).toBe('');
  });

  it('returns undefined (not 0) for missing numeric fields', () => {
    const r = extractor.extract('No numbers here at all.');
    expect(r.capacityKwh).toBeUndefined();
    expect(r.recycledContent?.cobaltPct).toBeUndefined();
    expect(r.lifecycle?.expectedCycles).toBeUndefined();
  });

  it('does not produce values outside valid percentage range (0–100)', () => {
    const r = extractor.extract('Kobalt: 150% recycled');
    expect(r.recycledContent?.cobaltPct).toBeUndefined();
  });

  it('does not produce values outside valid cycle range (100–100000)', () => {
    const r = extractor.extract('Lebensdauer: 50 Ladezyklen'); // too few
    expect(r.lifecycle?.expectedCycles).toBeUndefined();
  });

  it('handles English thousand-separator format ("1,000 cycles")', () => {
    const r = extractor.extract('Expected lifecycle: 3,000 cycles');
    expect(r.lifecycle?.expectedCycles).toBe(3000);
  });
});

// ─── QR code generation ───────────────────────────────────────────────────────

describe('generateQRCode', () => {
  it('returns a PNG data URL for a valid product ID', async () => {
    const qr = await generateQRCode('test-product-abc123');
    expect(qr).toMatch(/^data:image\/png;base64,/);
  });

  it('produces different QR codes for different product IDs', async () => {
    const [qr1, qr2] = await Promise.all([
      generateQRCode('product-A'),
      generateQRCode('product-B'),
    ]);
    expect(qr1).not.toBe(qr2);
  });

  it('produces a non-trivial base64 payload (>100 chars)', async () => {
    const qr = await generateQRCode('product-xyz');
    const base64 = qr.replace('data:image/png;base64,', '');
    expect(base64.length).toBeGreaterThan(100);
  });
});
