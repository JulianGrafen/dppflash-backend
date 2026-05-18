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
        value: [sampleConcernRow],
        sourcePdf: 's.pdf',
        contextSnippet: 'Abschnitt 3',
      },
    });
    expect(n.substancesOfConcern).toMatchObject({
      value: [sampleConcernRow],
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
        value: [sampleConcernRow],
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
});

describe('eagerExtractionResponseToRows', () => {
  it('persists substancesOfConcern rows', () => {
    const data = eagerExtractionResponseSchema.parse({
      substancesOfConcern: { value: [sampleConcernRow], sourcePdf: 's.pdf', contextSnippet: 'x' },
    });
    const rows = eagerExtractionResponseToRows(data, 'f.pdf');
    expect(rows.substancesOfConcern?.value).toEqual([sampleConcernRow]);
  });

  it('normalisiert hazardStatements / synonyme Felder zu H-, P-, GHS-Arrays', () => {
    const data = eagerExtractionResponseSchema.parse({
      substancesOfConcern: {
        value: [
          {
            name: 'Toluol',
            hazardStatements: 'H315, H336',
            precautionaryStatements: ['P261'],
            ghsSymbols: ['GHS08'],
            casNummer: '108-88-3',
            anteilOderGrenzwert: '< 25 %',
            hinweis: 'Beispiel',
          },
        ],
        sourcePdf: 'x.pdf',
        contextSnippet: 'Abschnitt 3',
      },
    });
    const rows = eagerExtractionResponseToRows(data, 'f.pdf');
    expect(rows.substancesOfConcern?.value).toMatchObject([
      {
        name: 'Toluol',
        hStatements: expect.arrayContaining(['H315', 'H336']),
        pStatements: ['P261'],
        ghsPictograms: ['GHS08'],
        casNummer: '108-88-3',
      },
    ]);
  });
});
