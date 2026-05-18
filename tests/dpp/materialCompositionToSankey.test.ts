import { describe, expect, it } from 'vitest';
import { compositionGraphSchema } from '@/app/domain/dpp/dppExtractionZodSchema';
import {
  compositionGraphHasMeaningfulFlows,
  parseChemicalConcentrationBandMidpoint,
  tryChemicalCompositionToSankey,
  tryMaterialCompositionToSankey,
  tryMaterialCompositionToSankeyFromRaw,
} from '@/app/domain/dpp/materialCompositionToSankey';

describe('tryMaterialCompositionToSankey', () => {
  it('returns null for non-array input', () => {
    expect(tryMaterialCompositionToSankey(null, 'X')).toBeNull();
    expect(tryMaterialCompositionToSankey({}, 'X')).toBeNull();
  });

  it('parses percentage strings with percent sign', () => {
    const graph = tryMaterialCompositionToSankey(
      [
        { material: 'A', percentage: '30%' },
        { material: 'B', percentage: '70' },
      ],
      'Prod',
    );
    expect(graph).not.toBeNull();
    expect(graph!.links[0]!.value).toBeCloseTo(30, 5);
    expect(graph!.links[1]!.value).toBeCloseTo(70, 5);
  });

  it('builds fan-in graph from material + percentage rows', () => {
    const graph = tryMaterialCompositionToSankey(
      [
        { material: 'PCR Polypropylene', percentage: 40 },
        { material: 'Recycled PET', percentage: 60 },
      ],
      'Magnum ECO Spinner',
    );
    expect(graph).not.toBeNull();
    const parsed = compositionGraphSchema.safeParse(graph);
    expect(parsed.success).toBe(true);
    expect(graph!.nodes.some((n) => n.id === 'end_product')).toBe(true);
    expect(graph!.links.every((l) => l.target === 'end_product')).toBe(true);
    expect(graph!.links.length).toBe(2);
  });

  it('uses equal weights when percentages are all zero', () => {
    const graph = tryMaterialCompositionToSankey(
      [
        { material: 'A', percentage: 0 },
        { material: 'B', percentage: 0 },
      ],
      'P',
    );
    expect(graph).not.toBeNull();
    expect(graph!.links[0]!.value).toBeCloseTo(50, 5);
    expect(graph!.links[1]!.value).toBeCloseTo(50, 5);
  });

  it('reads sharePercent when percentage is absent', () => {
    const graph = tryMaterialCompositionToSankey(
      [
        { name: 'Wolle', sharePercent: 60 },
        { material: 'Seide', anteil: 40 },
      ],
      'Schal',
    );
    expect(graph).not.toBeNull();
    expect(graph!.links[0]!.value).toBeCloseTo(60, 5);
    expect(graph!.links[1]!.value).toBeCloseTo(40, 5);
  });
});

describe('parseChemicalConcentrationBandMidpoint', () => {
  it('returns midpoint for SDS-style bands', () => {
    expect(parseChemicalConcentrationBandMidpoint('40-60 %')).toBe(50);
    expect(parseChemicalConcentrationBandMidpoint('20-40 %')).toBe(30);
    expect(parseChemicalConcentrationBandMidpoint('5-<10 %')).toBeCloseTo(7.5, 5);
    expect(parseChemicalConcentrationBandMidpoint('1-<5 %')).toBeCloseTo(3, 5);
    expect(parseChemicalConcentrationBandMidpoint('<1 %')).toBeCloseTo(0.5, 5);
    expect(parseChemicalConcentrationBandMidpoint('-')).toBeNull();
    expect(parseChemicalConcentrationBandMidpoint('—')).toBeNull();
  });
});

describe('tryChemicalCompositionToSankey', () => {
  it('builds a fan-in graph from SDS chemicalComposition rows', () => {
    const graph = tryChemicalCompositionToSankey(
      [
        {
          stoffname: 'Quarz (SiO2)',
          casNummer: '14808-60-7',
          prozentAnteil: '40-60 %',
        },
        {
          stoffname: 'Zement, Portland',
          casNummer: '65997-15-1',
          prozentAnteil: '20-40 %',
        },
        {
          stoffname: 'Kalkhaltiges Sedimentgestein',
          casNummer: '-',
          prozentAnteil: '5-<10 %',
        },
        {
          stoffname: 'Kaminstaub',
          casNummer: '68475-76-3',
          prozentAnteil: '1-<5 %',
        },
      ],
      'Magnum ECO Spinner',
    );
    expect(graph).not.toBeNull();
    expect(graph!.nodes.some((n) => n.category === 'final_product')).toBe(true);
    expect(graph!.links).toHaveLength(4);
    const parsed = compositionGraphSchema.safeParse(graph);
    expect(parsed.success).toBe(true);
  });
});

describe('tryMaterialCompositionToSankeyFromRaw', () => {
  it('does not build fan-in from regulatory materials alone (Kernfelder only)', () => {
    const graph = tryMaterialCompositionToSankeyFromRaw(
      {
        materialComposition: [],
        regulatoryExtraction: {
          materialCompositionAndSubstances: {
            materials: [
              {
                name: { value: 'PCR PP', sourcePdf: 'x.pdf', pageNumber: 1, contextSnippet: 'PCR PP' },
                sharePercent: { value: 55, sourcePdf: 'x.pdf', pageNumber: 1, contextSnippet: '55' },
              },
              {
                name: { value: 'rPET', sourcePdf: 'x.pdf', pageNumber: 1, contextSnippet: 'rPET' },
                sharePercent: { value: 45, sourcePdf: 'x.pdf', pageNumber: 1, contextSnippet: '45' },
              },
            ],
            chemicalDeclarations: [],
          },
        },
      },
      'Koffer',
    );
    expect(graph).toBeNull();
  });

  it('parses materialComposition stored as JSON string', () => {
    const graph = tryMaterialCompositionToSankeyFromRaw(
      {
        materialComposition: JSON.stringify([
          { material: 'Baumwolle', percentage: 70 },
          { name: 'Leinen', anteil: 30 },
        ]),
      },
      'Hemd',
    );
    expect(graph).not.toBeNull();
    expect(graph!.links).toHaveLength(2);
    expect(graph!.links[0]!.value).toBeCloseTo(70, 5);
    expect(graph!.links[1]!.value).toBeCloseTo(30, 5);
  });

  it('parses legacy materialZusammensetzung string when arrays are empty', () => {
    const graph = tryMaterialCompositionToSankeyFromRaw(
      {
        materialComposition: [],
        materialZusammensetzung: '95% Recyceltes Polyester, 5% Elasthan',
      },
      'T-Shirt',
    );
    expect(graph).not.toBeNull();
    expect(graph!.links.length).toBe(2);
    expect(graph!.links.some((l) => l.value > 0)).toBe(true);
  });

  it('does not use chemicalComposition as Kernfeld material substitute', () => {
    const graph = tryMaterialCompositionToSankeyFromRaw(
      {
        chemicalComposition: [
          { substance: 'Baumwolle', concentrationPercent: 80 },
          { substance: 'Polyester', concentrationPercent: 20 },
        ],
      },
      'Hose',
    );
    expect(graph).toBeNull();
  });

  it('compositionGraphHasMeaningfulFlows rejects all-zero links', () => {
    const g = {
      nodes: [
        { id: 'a', label: 'A', category: 'raw_material' as const },
        { id: 'b', label: 'B', category: 'final_product' as const },
      ],
      links: [{ source: 'a', target: 'b', value: 0 }],
    };
    expect(compositionGraphHasMeaningfulFlows(compositionGraphSchema.parse(g))).toBe(false);
  });
});
