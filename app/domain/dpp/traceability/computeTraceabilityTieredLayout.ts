import { calculateFlowRibbonPath } from '@/app/domain/dpp/traceability/calculateBezierPath';
import type { TraceabilityTieredFlowModel } from '@/app/domain/dpp/traceability/traceabilityTieredFlowModel';

export type LayoutRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type LayoutNode = {
  readonly id: string;
  readonly label: string;
  readonly tier: 1 | 2 | 3;
  readonly color: string;
  readonly sharePercent: number;
  readonly rect: LayoutRect;
};

export type LayoutFlow = {
  readonly id: string;
  readonly path: string;
  readonly gradientId: string;
  readonly sourceColor: string;
  readonly targetColor: string;
  readonly value: number;
  readonly sourceLabel: string;
  readonly targetLabel: string;
};

export type TraceabilityTieredLayout = {
  readonly viewBoxWidth: number;
  readonly viewBoxHeight: number;
  readonly nodes: readonly LayoutNode[];
  readonly flows: readonly LayoutFlow[];
  readonly columnLabels: readonly { readonly x: number; readonly label: string }[];
};

const VIEWBOX = { width: 1000, height: 520 } as const;
const CHART = { top: 72, height: 400, gap: 0 } as const;
const COLUMNS = {
  tier1: { x: 24, width: 210 },
  tier2: { x: 370, width: 230 },
  tier3: { x: 760, width: 210 },
} as const;

type NodePlacement = LayoutRect & {
  readonly nextSlotY: number;
};

function formatPercentDe(value: number): string {
  if (Number.isInteger(value)) {
    return `${value} %`;
  }
  return `${value.toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`;
}

function scaleHeight(sharePercent: number, totalPercent: number): number {
  if (totalPercent <= 0) {
    return 0;
  }
  return (sharePercent / totalPercent) * CHART.height;
}

function truncateLabel(label: string, max = 42): string {
  const trimmed = label.trim();
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

/**
 * **Layout-Engine** — 3 Spalten, konsistente vertikale Massenbilanz pro Ebene.
 */
export function computeTraceabilityTieredLayout(
  model: TraceabilityTieredFlowModel,
): TraceabilityTieredLayout {
  const nodeById = new Map(model.nodes.map((node) => [node.id, node]));
  const tier1 = model.nodes.filter((node) => node.tier === 1);
  const tier2 = model.nodes.filter((node) => node.tier === 2);
  const tier3 = model.nodes.filter((node) => node.tier === 3);
  const totalMass = tier1.reduce((sum, node) => sum + node.sharePercent, 0);

  const placements = new Map<string, NodePlacement>();

  let yCursor = CHART.top;
  for (const node of tier1) {
    const height = scaleHeight(node.sharePercent, totalMass);
    placements.set(node.id, {
      x: COLUMNS.tier1.x,
      y: yCursor,
      width: COLUMNS.tier1.width,
      height,
      nextSlotY: yCursor,
    });
    yCursor += height + CHART.gap;
  }

  yCursor = CHART.top;
  for (const node of tier2) {
    const height = scaleHeight(node.sharePercent, totalMass);
    placements.set(node.id, {
      x: COLUMNS.tier2.x,
      y: yCursor,
      width: COLUMNS.tier2.width,
      height,
      nextSlotY: yCursor,
    });
    yCursor += height + CHART.gap;
  }

  for (const node of tier3) {
    placements.set(node.id, {
      x: COLUMNS.tier3.x,
      y: CHART.top,
      width: COLUMNS.tier3.width,
      height: CHART.height,
      nextSlotY: CHART.top,
    });
  }

  const flows: LayoutFlow[] = [];

  for (const link of model.links) {
    const source = nodeById.get(link.sourceId);
    const target = nodeById.get(link.targetId);
    const sourcePlacement = placements.get(link.sourceId);
    const targetPlacement = placements.get(link.targetId);
    if (!source || !target || !sourcePlacement || !targetPlacement) {
      continue;
    }

    const flowHeight = scaleHeight(link.value, totalMass);
    const sourceY0 = sourcePlacement.y;
    const sourceY1 = sourceY0 + flowHeight;

    let targetY0: number;
    let targetY1: number;

    if (target.tier === 3) {
      targetY0 = targetPlacement.nextSlotY;
      targetY1 = targetY0 + flowHeight;
      placements.set(link.targetId, {
        ...targetPlacement,
        nextSlotY: targetY1,
      });
    } else {
      targetY0 = targetPlacement.nextSlotY;
      targetY1 = targetY0 + flowHeight;
      placements.set(link.targetId, {
        ...targetPlacement,
        nextSlotY: targetY1,
      });
    }

    const startX = sourcePlacement.x + sourcePlacement.width;
    const endX = targetPlacement.x;

    flows.push({
      id: link.id,
      path: calculateFlowRibbonPath(startX, sourceY0, sourceY1, endX, targetY0, targetY1),
      gradientId: `flow-gradient-${link.id}`,
      sourceColor: link.color,
      targetColor: target.color,
      value: link.value,
      sourceLabel: source.label,
      targetLabel: target.label,
    });
  }

  const layoutNodes: LayoutNode[] = model.nodes.flatMap((node) => {
    const placement = placements.get(node.id);
    if (!placement) {
      return [];
    }
    return [{
      id: node.id,
      label: node.label,
      tier: node.tier,
      color: node.color,
      sharePercent: node.sharePercent,
      rect: {
        x: placement.x,
        y: placement.y,
        width: placement.width,
        height: placement.height,
      },
    }];
  });

  return {
    viewBoxWidth: VIEWBOX.width,
    viewBoxHeight: VIEWBOX.height,
    nodes: layoutNodes,
    flows,
    columnLabels: [
      { x: COLUMNS.tier1.x, label: 'Rohstoffe' },
      { x: COLUMNS.tier2.x, label: 'Herkunft / Verarbeitung' },
      { x: COLUMNS.tier3.x, label: 'Endprodukt' },
    ],
  };
}

export function formatTraceabilityFlowTooltip(flow: LayoutFlow): string {
  return `${truncateLabel(flow.sourceLabel)} → ${truncateLabel(flow.targetLabel)} · ${formatPercentDe(flow.value)}`;
}

export function formatTraceabilityNodeTooltip(node: LayoutNode): string {
  return `${truncateLabel(node.label)} · ${formatPercentDe(node.sharePercent)}`;
}
