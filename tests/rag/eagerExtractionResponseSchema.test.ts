import { describe, expect, it } from 'vitest';
import {
  coerceLegacyChemicalCompositionValue,
  eagerExtractionResponseSchema,
  eagerExtractionResponseToRows,
  normalizeEagerExtractionRawObject,
} from '@/app/domain/rag/eagerExtractionResponseSchema';

const sampleCompRow = {
  stoffname: 'Quarz (SiO2)',
  casNummer: '14808-60-7',
  prozentAnteil: '40 – 60 %',
  einstufung: 'STOT SE 3, H335',
};

const sampleConcernRow = {
  name: 'Blei',
  casNummer: '7439-92-1',
  anteilOderGrenzwert: '< 0,1 %',
  hinweis: 'SVHC-Kandidat (Beispiel)',
};

const sampleConcernString = 'Blei (CAS 7439-92-1) — SVHC-Kandidat';

describe('coerceLegacyChemicalCompositionValue', () => {
  it('wraps non-empty strings as single SDS row', () => {
    expect(coerceLegacyChemicalCompositionValue('  X  ')).toEqual([
      { stoffname: 'X', casNummer: null, prozentAnteil: '', einstufung: null },
    ]);
  });
});

describe('normalizeEagerExtractionRawObject', () => {
  it('maps materialZusammensetzung to chemicalComposition as structured rows', () => {
    const n = normalizeEagerExtractionRawObject({
      materialZusammensetzung: { value: 'Quarz', sourcePdf: 'b.pdf', contextSnippet: 'Abschnitt 3' },
    });
    expect(n).toEqual({
      chemicalComposition: {
        value: [{ stoffname: 'Quarz', casNummer: null, prozentAnteil: '', einstufung: null }],
        sourcePdf: 'b.pdf',
        contextSnippet: 'Abschnitt 3',
      },
    });
  });

  it('maps gefahrenstoffe alias to substancesOfConcern', () => {
    const n = normalizeEagerExtractionRawObject({
      gefahrenstoffe: {
        value: [sampleConcernString],
        sourcePdf: 's.pdf',
        contextSnippet: 'Abschnitt 3',
      },
    });
    expect(n.substancesOfConcern).toMatchObject({
      value: [sampleConcernString],
      sourcePdf: 's.pdf',
    });
  });

  it('prefers longer legacy string when two keys collapse to chemicalComposition', () => {
    const n = normalizeEagerExtractionRawObject({
      materialComposition: { value: 'A', sourcePdf: '1.pdf', contextSnippet: 'x' },
      chemicalComposition: { value: 'AAA', sourcePdf: '2.pdf', contextSnippet: 'y' },
    });
    expect((n.chemicalComposition as { value: unknown }).value).toEqual([
      { stoffname: 'AAA', casNummer: null, prozentAnteil: '', einstufung: null },
    ]);
  });

  it('maps ufi canonical alias to top-level upi', () => {
    const n = normalizeEagerExtractionRawObject({
      ufi: { value: 'X0000-AAAA-BBBB-CCCC-VVNN', sourcePdf: 'mix.pdf', contextSnippet: 'Abschnitt 1.2' },
    });
    expect(n.upi).toMatchObject({
      value: 'X0000-AAAA-BBBB-CCCC-VVNN',
      sourcePdf: 'mix.pdf',
    });
  });

  it('prefers richer hStatements bucket when synonyms collide', () => {
    const n = normalizeEagerExtractionRawObject({
      hStatements: {
        value: ['H302'],
        sourcePdf: 'a.pdf',
        contextSnippet: 'x',
      },
      gefahrenhinweise: {
        value: ['H302', 'H315'],
        sourcePdf: 'b.pdf',
        contextSnippet: 'y',
      },
    });
    expect((n.hStatements as { value: unknown }).value).toEqual(['H302', 'H315']);
  });
});

describe('eagerExtractionResponseSchema', () => {
  it('accepts chemicalComposition + substancesOfConcern together', () => {
    const r = eagerExtractionResponseSchema.safeParse({
      chemicalComposition: {
        value: [
          sampleCompRow,
          { stoffname: 'Binder', casNummer: null, prozentAnteil: '40 – 60 %', einstufung: null },
        ],
        sourcePdf: 'a.pdf',
        contextSnippet: '§3',
      },
      substancesOfConcern: {
        value: [sampleConcernString],
        sourcePdf: 'a.pdf',
        contextSnippet: 'SVHC',
      },
    });
    expect(r.success).toBe(true);
  });

  it('rejects chemicalComposition flat string value', () => {
    const r = eagerExtractionResponseSchema.safeParse({
      chemicalComposition: { value: 'Quarz, Zement', sourcePdf: 'a.pdf', contextSnippet: 'x' },
    });
    expect(r.success).toBe(false);
  });

  it('accepts regulatorische Produktfelder upi / hStatements / ghsSymbols', () => {
    const r = eagerExtractionResponseSchema.safeParse({
      upi: { value: 'U123', sourcePdf: 's.pdf', contextSnippet: 'UFI/UPI' },
      hStatements: { value: ['H315', 'H317'], sourcePdf: 's.pdf', contextSnippet: 'Abschnitt 2.1' },
      pStatements: { value: ['P102', 'P280'], sourcePdf: 's.pdf', contextSnippet: 'Abschnitt 2.2' },
      ghsSymbols: { value: ['GHS05', 'GHS07'], sourcePdf: 's.pdf', contextSnippet: 'Kennzeichnung' },
      substancesOfConcern: {
        value: ['Dibutyl phthalate (SVHC)', 'Lead compounds (REACH candidate list)'],
        sourcePdf: 's.pdf',
        contextSnippet: 'Abschnitt 15',
      },
    });
    expect(r.success).toBe(true);
    if (!r.success) {
      throw r.error;
    }
  });

  it('coerces numeric ghsSymbols and ghsPictograms alias', () => {
    const normalized = normalizeEagerExtractionRawObject({
      ghsPictograms: { value: [5, 7], sourcePdf: 's.pdf', contextSnippet: 'x' },
    });
    const r = eagerExtractionResponseSchema.safeParse(normalized);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.ghsSymbols?.value).toEqual(['GHS05', 'GHS07']);
    }
  });

  it('accepts Merkblatt-Feld handlingAndApplicationInstructions', () => {
    const r = eagerExtractionResponseSchema.safeParse({
      handlingAndApplicationInstructions: {
        value: 'Temperatur 5–35 °C, Schutzhandschuhe DIN EN; Werkzeug sofort nach Gebrauch mit Wasser reinigen.',
        sourcePdf: 't.pdf',
        contextSnippet: 'Verarbeitungs-Hinweise und Reinigung',
      },
    });
    expect(r.success).toBe(true);
  });
});

describe('eagerExtractionResponseToRows', () => {
  it('persists substancesOfConcern rows', () => {
    const data = eagerExtractionResponseSchema.parse({
      substancesOfConcern: { value: [sampleConcernString], sourcePdf: 's.pdf', contextSnippet: 'x' },
    });
    const rows = eagerExtractionResponseToRows(data, 'f.pdf');
    expect(rows.substancesOfConcern?.value).toEqual([sampleConcernString]);
  });

  it('persistiert Produkt-Level h/p/ghs/svhc in extracted_attributes', () => {
    const data = eagerExtractionResponseSchema.parse({
      hStatements: { value: ['H302'], sourcePdf: 's.pdf', contextSnippet: 'CLP Abschnitt 2' },
      pStatements: { value: ['P102'], sourcePdf: 's.pdf', contextSnippet: 'CLP Abschnitt 2' },
      ghsSymbols: { value: ['GHS06'], sourcePdf: 's.pdf', contextSnippet: 'Piktogramm' },
      substancesOfConcern: { value: ['Lead compounds (SVHC)'], sourcePdf: 's.pdf', contextSnippet: 'Abschnitt 15' },
    });
    const rows = eagerExtractionResponseToRows(data, 'fallback.pdf');
    expect(rows.hStatements?.value).toEqual(['H302']);
    expect(rows.pStatements?.value).toEqual(['P102']);
    expect(rows.ghsSymbols?.value).toEqual(['GHS06']);
    expect(rows.substancesOfConcern?.value).toEqual(['Lead compounds (SVHC)']);
    expect(rows.hStatements?.sourcePdf).toBe('s.pdf');
  });

  it('accepts substancesOfConcern as explicit string-array from SDS/REACH lists', () => {
    const data = eagerExtractionResponseSchema.parse({
      substancesOfConcern: {
        value: ['Toluol (SVHC candidate list)'],
        sourcePdf: 'x.pdf',
        contextSnippet: 'Abschnitt 3',
      },
    });
    const rows = eagerExtractionResponseToRows(data, 'f.pdf');
    expect(rows.substancesOfConcern?.value).toEqual(['Toluol (SVHC candidate list)']);
  });
});
