import { describe, expect, it } from 'vitest';
import { compositionGraphSchema } from '@/app/domain/dpp/dppExtractionZodSchema';
import { tryMaterialCompositionToSankey } from '@/app/domain/dpp/materialCompositionToSankey';

describe('tryMaterialCompositionToSankey', () => {
  it('returns null for non-array input', () => {
    expect(tryMaterialCompositionToSankey(null, 'X')).toBeNull();
    expect(tryMaterialCompositionToSankey({}, 'X')).toBeNull();
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
});
