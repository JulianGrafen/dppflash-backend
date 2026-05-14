import {
  compositionGraphSchema,
  type CompositionGraphPayload,
} from '@/app/domain/dpp/dppExtractionZodSchema';

function clampLabel(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) {
    return t;
  }
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

/**
 * Builds a minimal fan-in Sankey (materials → product) from ESPR `materialComposition` rows
 * when no regulatory `compositionGraph` exists.
 */
export function tryMaterialCompositionToSankey(
  value: unknown,
  productLabel: string,
): CompositionGraphPayload | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const rows: { readonly material: string; readonly percentage: number }[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const material =
      'material' in entry && typeof entry.material === 'string' ? entry.material.trim() : '';
    if (!material) {
      continue;
    }
    const rawPct =
      'percentage' in entry && typeof entry.percentage === 'number' && Number.isFinite(entry.percentage)
        ? entry.percentage
        : 0;
    rows.push({ material, percentage: Math.max(0, rawPct) });
  }

  if (rows.length === 0) {
    return null;
  }

  const sumPct = rows.reduce((a, r) => a + r.percentage, 0);
  const weights =
    sumPct > 0
      ? rows.map((r) => (r.percentage / sumPct) * 100)
      : rows.map(() => 100 / rows.length);

  const productId = 'end_product';
  const endLabel =
    productLabel.trim().length > 0 ? clampLabel(productLabel.trim(), 44) : 'Produkt';

  const nodes = [
    ...rows.map((r, i) => ({
      id: `mat_${i}`,
      label: clampLabel(r.material, 42),
      category: 'raw_material' as const,
    })),
    {
      id: productId,
      label: endLabel,
      category: 'final_product' as const,
    },
  ];

  const links = rows.map((_, i) => ({
    source: `mat_${i}`,
    target: productId,
    value: Math.max(0.01, weights[i] ?? 0),
  }));

  const parsed = compositionGraphSchema.safeParse({ nodes, links });
  return parsed.success ? parsed.data : null;
}
