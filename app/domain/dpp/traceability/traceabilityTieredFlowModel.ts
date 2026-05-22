import {
  closeSankeyRowsWithNonDeclarableFiller,
  collectPassportCoreMaterialRowsForSankey,
  extractChemicalCompositionRowsForSankey,
} from '@/app/domain/dpp/materialCompositionToSankey';

export type TraceabilityFlowTier = 1 | 2 | 3;

export type TraceabilityFlowNode = {
  readonly id: string;
  readonly label: string;
  readonly tier: TraceabilityFlowTier;
  readonly sharePercent: number;
  readonly color: string;
};

export type TraceabilityFlowLink = {
  readonly id: string;
  readonly sourceId: string;
  readonly targetId: string;
  readonly value: number;
  readonly color: string;
};

export type TraceabilityTieredFlowModel = {
  readonly nodes: readonly TraceabilityFlowNode[];
  readonly links: readonly TraceabilityFlowLink[];
  readonly productLabel: string;
};

export const TRACEABILITY_MATERIAL_COLORS = [
  '#0f766e',
  '#059669',
  '#2563eb',
  '#4f46e5',
  '#7c3aed',
  '#c026d3',
  '#db2777',
  '#d97706',
] as const;

export const TRACEABILITY_PROCESSING_EU = {
  id: 'origin_eu',
  label: 'Regionale Rohstoffgewinnung (EU)',
  color: '#2563eb',
} as const;

export const TRACEABILITY_PROCESSING_ASIA = {
  id: 'origin_asia',
  label: 'Globale Lieferkette (Asien)',
  color: '#4f46e5',
} as const;

export const TRACEABILITY_PROCESSING_DEFAULT = {
  id: 'origin_processing',
  label: 'Herkunft / Verarbeitung (Tier-1)',
  color: '#2563eb',
} as const;

export const TRACEABILITY_PRODUCT_COLOR = '#7c3aed';

const PRODUCT_NODE_ID = 'end_product';

type MaterialRow = {
  readonly material: string;
  readonly percentage: number;
};

function slugifyMaterialId(material: string, index: number): string {
  const base = material
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48);
  return `raw_${base || 'material'}_${index}`;
}

/** **Routing-Heuristik** — ordnet SDB-Stoffe den Mock-Herkunftsknoten zu. */
export function resolveProcessingNodeId(materialName: string): typeof TRACEABILITY_PROCESSING_EU.id | typeof TRACEABILITY_PROCESSING_ASIA.id {
  const norm = materialName.trim().toLowerCase();
  if (
    /quarz|sio2|silicium|nicht\s+deklarationspflichtig|füllstoff|fuellstoff|sonstige/.test(norm)
  ) {
    return TRACEABILITY_PROCESSING_ASIA.id;
  }
  if (/zement|portland|sediment|kaminstaub|kalkhaltig/.test(norm)) {
    return TRACEABILITY_PROCESSING_EU.id;
  }
  return TRACEABILITY_PROCESSING_EU.id;
}

type BuildTraceabilityTieredFlowModelInput = {
  readonly materials: readonly MaterialRow[];
  readonly productLabel: string;
  /** Fallback: ein einzelner Tier-1-Knoten statt EU/Asien-Split. */
  readonly singleProcessingNode?: boolean;
};

/**
 * **3-Ebenen-Datenmodell**: Rohstoffe → Herkunft/Verarbeitung → Endprodukt.
 */
export function buildTraceabilityTieredFlowModel(
  input: BuildTraceabilityTieredFlowModelInput,
): TraceabilityTieredFlowModel | null {
  const balanced = closeSankeyRowsWithNonDeclarableFiller([...input.materials]);
  if (balanced.length === 0) {
    return null;
  }

  const productLabel = input.productLabel.trim() || 'Produkt';
  const rawNodes: TraceabilityFlowNode[] = balanced.map((row, index) => ({
    id: slugifyMaterialId(row.material, index),
    label: row.material.trim(),
    tier: 1,
    sharePercent: row.percentage,
    color: TRACEABILITY_MATERIAL_COLORS[index % TRACEABILITY_MATERIAL_COLORS.length] ?? '#64748b',
  }));

  const processingDefs = input.singleProcessingNode
    ? [TRACEABILITY_PROCESSING_DEFAULT]
    : [TRACEABILITY_PROCESSING_EU, TRACEABILITY_PROCESSING_ASIA];

  const processingTotals = new Map<string, number>();
  for (const def of processingDefs) {
    processingTotals.set(def.id, 0);
  }

  const tier1ToTier2Links: TraceabilityFlowLink[] = [];
  for (const raw of rawNodes) {
    const targetId = input.singleProcessingNode
      ? TRACEABILITY_PROCESSING_DEFAULT.id
      : resolveProcessingNodeId(raw.label);
    processingTotals.set(targetId, (processingTotals.get(targetId) ?? 0) + raw.sharePercent);
    tier1ToTier2Links.push({
      id: `link_${raw.id}_${targetId}`,
      sourceId: raw.id,
      targetId,
      value: raw.sharePercent,
      color: raw.color,
    });
  }

  const processingNodes: TraceabilityFlowNode[] = processingDefs
    .map((def) => ({
      id: def.id,
      label: def.label,
      tier: 2 as const,
      sharePercent: processingTotals.get(def.id) ?? 0,
      color: def.color,
    }))
    .filter((node) => node.sharePercent > 0.05);

  if (processingNodes.length === 0) {
    return null;
  }

  const productShare = processingNodes.reduce((sum, node) => sum + node.sharePercent, 0);
  const productNode: TraceabilityFlowNode = {
    id: PRODUCT_NODE_ID,
    label: productLabel,
    tier: 3,
    sharePercent: productShare,
    color: TRACEABILITY_PRODUCT_COLOR,
  };

  const tier2ToProductLinks: TraceabilityFlowLink[] = processingNodes.map((node) => ({
    id: `link_${node.id}_${PRODUCT_NODE_ID}`,
    sourceId: node.id,
    targetId: PRODUCT_NODE_ID,
    value: node.sharePercent,
    color: node.color,
  }));

  return {
    nodes: [...rawNodes, ...processingNodes, productNode],
    links: [...tier1ToTier2Links, ...tier2ToProductLinks],
    productLabel,
  };
}

export function buildTraceabilityTieredFlowFromRaw(
  raw: Record<string, unknown>,
  productLabel: string,
): TraceabilityTieredFlowModel | null {
  const chemicalRows = extractChemicalCompositionRowsForSankey(raw.chemicalComposition);
  if (chemicalRows.length > 0) {
    return buildTraceabilityTieredFlowModel({
      materials: [...chemicalRows],
      productLabel,
      singleProcessingNode: false,
    });
  }

  const materialRows = collectPassportCoreMaterialRowsForSankey(raw);
  if (materialRows.length > 0) {
    return buildTraceabilityTieredFlowModel({
      materials: [...materialRows],
      productLabel,
      singleProcessingNode: true,
    });
  }

  return null;
}
