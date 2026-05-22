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
  readonly labelRect: LayoutRect;
  readonly labelAnchor: 'start' | 'middle' | 'end';
  readonly labelLines: readonly string[];
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
  readonly stackHeight: number;
  readonly nodes: readonly LayoutNode[];
  readonly flows: readonly LayoutFlow[];
  readonly columnLabels: readonly { readonly x: number; readonly label: string }[];
};

const VIEWBOX_WIDTH = 1180;
const HEADER_HEIGHT = 72;
const CHART_TOP = 96;
const MIN_BAND_HEIGHT = 32;
const BAND_GAP = 8;
const BASE_STACK_HEIGHT = 400;

const COLUMNS = {
  tier1Label: { x: 12, width: 268 },
  tier1Bar: { x: 288, width: 32 },
  tier2Bar: { x: 468, width: 32 },
  tier2Label: { x: 512, width: 268 },
  tier3Bar: { x: 860, width: 36 },
  tier3Label: { x: 908, width: 260 },
} as const;

type NodePlacement = LayoutRect & {
  nextSlotY: number;
};

function formatPercentDe(value: number): string {
  if (Number.isInteger(value)) {
    return `${value} %`;
  }
  return `${value.toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`;
}

function truncateLabel(label: string, max = 42): string {
  const trimmed = label.trim();
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

function wrapLabelLines(label: string, maxCharsPerLine: number, maxLines = 3): string[] {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [''];
  }

  const lines: string[] = [];
  let current = words[0] ?? '';

  for (const word of words.slice(1)) {
    const candidate = `${current} ${word}`;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
    if (lines.length >= maxLines - 1) {
      break;
    }
  }

  lines.push(current);

  if (lines.length > maxLines) {
    return lines.slice(0, maxLines);
  }

  const consumedWords = lines.join(' ').split(/\s+/).length;
  if (consumedWords < words.length && lines.length > 0) {
    const last = lines[lines.length - 1] ?? '';
    lines[lines.length - 1] = last.length > maxCharsPerLine - 1
      ? `${last.slice(0, maxCharsPerLine - 1).trimEnd()}…`
      : `${last}…`;
  }

  return lines;
}

function stackHeightFromBandMap(
  nodes: readonly { readonly id: string }[],
  heightsById: Map<string, number>,
): number {
  const body = nodes.reduce((sum, node) => sum + (heightsById.get(node.id) ?? MIN_BAND_HEIGHT), 0);
  return body + Math.max(0, nodes.length - 1) * BAND_GAP;
}

function resolveSharedStackHeight(
  tier1: readonly { readonly id: string; readonly sharePercent: number }[],
  tier2: readonly { readonly id: string; readonly sharePercent: number }[],
  totalPercent: number,
): { readonly stackHeight: number; readonly tier1Heights: Map<string, number>; readonly tier2Heights: Map<string, number> } {
  let stackHeight = BASE_STACK_HEIGHT;
  let tier1Heights = computeTierBandHeights(tier1, totalPercent, stackHeight);
  let tier2Heights = computeTierBandHeights(tier2, totalPercent, stackHeight);

  for (let iteration = 0; iteration < 64; iteration += 1) {
    tier1Heights = computeTierBandHeights(tier1, totalPercent, stackHeight);
    tier2Heights = computeTierBandHeights(tier2, totalPercent, stackHeight);
    const nextHeight = Math.max(
      stackHeightFromBandMap(tier1, tier1Heights),
      stackHeightFromBandMap(tier2, tier2Heights),
    );

    if (nextHeight <= stackHeight + 0.001) {
      return {
        stackHeight: nextHeight,
        tier1Heights: computeTierBandHeights(tier1, totalPercent, nextHeight),
        tier2Heights: computeTierBandHeights(tier2, totalPercent, nextHeight),
      };
    }

    stackHeight = nextHeight;
  }

  tier1Heights = computeTierBandHeights(tier1, totalPercent, stackHeight);
  tier2Heights = computeTierBandHeights(tier2, totalPercent, stackHeight);
  return {
    stackHeight: Math.max(
      stackHeight,
      stackHeightFromBandMap(tier1, tier1Heights),
      stackHeightFromBandMap(tier2, tier2Heights),
    ),
    tier1Heights,
    tier2Heights,
  };
}

function computeTierBandHeights(
  nodes: readonly { readonly id: string; readonly sharePercent: number }[],
  totalPercent: number,
  columnHeight: number,
): Map<string, number> {
  const gaps = Math.max(0, nodes.length - 1) * BAND_GAP;
  const available = columnHeight - gaps;
  const heightsById = new Map<string, number>();

  for (const node of nodes) {
    heightsById.set(
      node.id,
      Math.max(MIN_BAND_HEIGHT, (node.sharePercent / totalPercent) * available),
    );
  }

  return heightsById;
}

function flowBandHeight(linkValue: number, totalPercent: number, columnHeight: number, tierNodeCount: number): number {
  const gaps = Math.max(0, tierNodeCount - 1) * BAND_GAP;
  const available = columnHeight - gaps;
  return Math.max(MIN_BAND_HEIGHT, (linkValue / totalPercent) * available);
}

function placeTierStack(
  nodes: readonly { readonly id: string; readonly sharePercent: number }[],
  heightsById: Map<string, number>,
  barX: number,
  barWidth: number,
): Map<string, NodePlacement> {
  const placements = new Map<string, NodePlacement>();
  let yCursor = CHART_TOP;

  for (const node of nodes) {
    const height = heightsById.get(node.id) ?? MIN_BAND_HEIGHT;
    placements.set(node.id, {
      x: barX,
      y: yCursor,
      width: barWidth,
      height,
      nextSlotY: yCursor,
    });
    yCursor += height + BAND_GAP;
  }

  return placements;
}

function buildLabelMeta(
  node: { readonly label: string; readonly tier: 1 | 2 | 3; readonly sharePercent: number },
  bar: LayoutRect,
): Pick<LayoutNode, 'labelRect' | 'labelAnchor' | 'labelLines'> {
  if (node.tier === 1) {
    return {
      labelRect: {
        x: COLUMNS.tier1Label.x,
        y: bar.y,
        width: COLUMNS.tier1Label.width,
        height: bar.height,
      },
      labelAnchor: 'end',
      labelLines: wrapLabelLines(node.label, 34, 3),
    };
  }

  if (node.tier === 2) {
    return {
      labelRect: {
        x: COLUMNS.tier2Label.x,
        y: bar.y,
        width: COLUMNS.tier2Label.width,
        height: bar.height,
      },
      labelAnchor: 'start',
      labelLines: wrapLabelLines(node.label, 36, 3),
    };
  }

  return {
    labelRect: {
      x: COLUMNS.tier3Label.x,
      y: bar.y,
      width: COLUMNS.tier3Label.width,
      height: bar.height,
    },
    labelAnchor: 'start',
    labelLines: wrapLabelLines(node.label, 34, 4),
  };
}

/**
 * **Layout-Engine** — 3 Spalten, konsistente vertikale Massenbilanz, Mindestbandhöhe gegen Überlappung.
 */
export function computeTraceabilityTieredLayout(
  model: TraceabilityTieredFlowModel,
): TraceabilityTieredLayout {
  const nodeById = new Map(model.nodes.map((node) => [node.id, node]));
  const tier1 = model.nodes.filter((node) => node.tier === 1);
  const tier2 = model.nodes.filter((node) => node.tier === 2);
  const tier3 = model.nodes.filter((node) => node.tier === 3);
  const totalMass = tier1.reduce((sum, node) => sum + node.sharePercent, 0);
  const resolved = resolveSharedStackHeight(tier1, tier2, totalMass);
  const stackHeight = resolved.stackHeight;
  const tier1Heights = resolved.tier1Heights;
  const tier2Heights = resolved.tier2Heights;

  const placements = new Map<string, NodePlacement>();
  const tier1Placements = placeTierStack(
    tier1,
    tier1Heights,
    COLUMNS.tier1Bar.x,
    COLUMNS.tier1Bar.width,
  );
  const tier2Placements = placeTierStack(
    tier2,
    tier2Heights,
    COLUMNS.tier2Bar.x,
    COLUMNS.tier2Bar.width,
  );

  for (const [id, placement] of tier1Placements) {
    placements.set(id, placement);
  }
  for (const [id, placement] of tier2Placements) {
    placements.set(id, placement);
  }

  for (const node of tier3) {
    placements.set(node.id, {
      x: COLUMNS.tier3Bar.x,
      y: CHART_TOP,
      width: COLUMNS.tier3Bar.width,
      height: stackHeight,
      nextSlotY: CHART_TOP,
    });
  }

  const sortedLinks = [...model.links].sort((a, b) => {
    const tierDelta =
      (nodeById.get(a.sourceId)?.tier ?? 0) - (nodeById.get(b.sourceId)?.tier ?? 0);
    if (tierDelta !== 0) {
      return tierDelta;
    }

    const sourceYA = placements.get(a.sourceId)?.y ?? 0;
    const sourceYB = placements.get(b.sourceId)?.y ?? 0;
    if (sourceYA !== sourceYB) {
      return sourceYA - sourceYB;
    }

    return a.id.localeCompare(b.id);
  });

  const flows: LayoutFlow[] = [];

  for (const link of sortedLinks) {
    const source = nodeById.get(link.sourceId);
    const target = nodeById.get(link.targetId);
    const sourcePlacement = placements.get(link.sourceId);
    const targetPlacement = placements.get(link.targetId);
    if (!source || !target || !sourcePlacement || !targetPlacement) {
      continue;
    }

    const sourceTierCount = source.tier === 1 ? tier1.length : tier2.length;
    const flowHeight = flowBandHeight(link.value, totalMass, stackHeight, sourceTierCount);
    const sourceY0 = sourcePlacement.nextSlotY;
    const sourceY1 = sourceY0 + flowHeight;
    const targetY0 = targetPlacement.nextSlotY;
    const targetY1 = targetY0 + flowHeight;

    placements.set(link.sourceId, {
      ...sourcePlacement,
      nextSlotY: sourceY1,
    });
    placements.set(link.targetId, {
      ...targetPlacement,
      nextSlotY: targetY1,
    });

    flows.push({
      id: link.id,
      path: calculateFlowRibbonPath(
        sourcePlacement.x + sourcePlacement.width,
        sourceY0,
        sourceY1,
        targetPlacement.x,
        targetY0,
        targetY1,
        { bendRatio: 0.5 },
      ),
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

    const barRect = {
      x: placement.x,
      y: placement.y,
      width: placement.width,
      height: placement.height,
    };
    const labelMeta = buildLabelMeta(node, barRect);

    return [{
      id: node.id,
      label: node.label,
      tier: node.tier,
      color: node.color,
      sharePercent: node.sharePercent,
      rect: barRect,
      ...labelMeta,
    }];
  });

  const viewBoxHeight = CHART_TOP + stackHeight + 32;

  return {
    viewBoxWidth: VIEWBOX_WIDTH,
    viewBoxHeight,
    stackHeight,
    nodes: layoutNodes,
    flows,
    columnLabels: [
      { x: COLUMNS.tier1Label.x, label: 'Rohstoffe' },
      { x: COLUMNS.tier2Label.x, label: 'Herkunft / Verarbeitung' },
      { x: COLUMNS.tier3Label.x, label: 'Endprodukt' },
    ],
  };
}

export function formatTraceabilityFlowTooltip(flow: LayoutFlow): string {
  return `${truncateLabel(flow.sourceLabel)} → ${truncateLabel(flow.targetLabel)} · ${formatPercentDe(flow.value)}`;
}

export function formatTraceabilityNodeTooltip(node: LayoutNode): string {
  return `${truncateLabel(node.label)} · ${formatPercentDe(node.sharePercent)}`;
}
