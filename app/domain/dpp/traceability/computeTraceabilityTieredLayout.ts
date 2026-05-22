import { calculateBezierPath } from '@/app/domain/dpp/traceability/calculateBezierPath';
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
  readonly strokeWidth: number;
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
const VIEWBOX_HEIGHT = 380;
const HEADER_Y = 38;
const LANE_TOP = 78;
const LANE_GAP = 14;
const RAW_NODE_HEIGHT = 42;
const PROCESS_NODE_HEIGHT = 72;
const PRODUCT_NODE_HEIGHT = 88;

const COLUMNS = {
  tier1: { x: 24, width: 250 },
  tier2: { x: 450, width: 250 },
  tier3: { x: 890, width: 250 },
} as const;

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

function wrapLabelLines(label: string, maxCharsPerLine: number, maxLines = 2): string[] {
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

function flowStrokeWidth(linkValue: number, totalPercent: number): number {
  if (totalPercent <= 0) {
    return 4;
  }
  return Math.max(4, Math.min(20, (linkValue / totalPercent) * 30));
}

function centerY(rect: LayoutRect): number {
  return rect.y + rect.height / 2;
}

function buildLabelMeta(
  node: { readonly label: string; readonly tier: 1 | 2 | 3; readonly sharePercent: number },
  rect: LayoutRect,
): Pick<LayoutNode, 'labelRect' | 'labelAnchor' | 'labelLines'> {
  return {
    labelRect: rect,
    labelAnchor: 'middle',
    labelLines: wrapLabelLines(node.label, node.tier === 3 ? 28 : 30, node.tier === 3 ? 3 : 2),
  };
}

function placeRawNodes(tier1: readonly { readonly id: string }[]): Map<string, LayoutRect> {
  const placements = new Map<string, LayoutRect>();
  for (const [index, node] of tier1.entries()) {
    placements.set(node.id, {
      x: COLUMNS.tier1.x,
      y: LANE_TOP + index * (RAW_NODE_HEIGHT + LANE_GAP),
      width: COLUMNS.tier1.width,
      height: RAW_NODE_HEIGHT,
    });
  }
  return placements;
}

function placeProcessingNodes(
  tier2: readonly { readonly id: string }[],
  rawStackHeight: number,
): Map<string, LayoutRect> {
  const placements = new Map<string, LayoutRect>();
  const totalHeight = tier2.length * PROCESS_NODE_HEIGHT + Math.max(0, tier2.length - 1) * 42;
  const startY = LANE_TOP + Math.max(0, (rawStackHeight - totalHeight) / 2);

  for (const [index, node] of tier2.entries()) {
    placements.set(node.id, {
      x: COLUMNS.tier2.x,
      y: startY + index * (PROCESS_NODE_HEIGHT + 42),
      width: COLUMNS.tier2.width,
      height: PROCESS_NODE_HEIGHT,
    });
  }
  return placements;
}

function placeProductNodes(
  tier3: readonly { readonly id: string }[],
  rawStackHeight: number,
): Map<string, LayoutRect> {
  const placements = new Map<string, LayoutRect>();
  for (const node of tier3) {
    placements.set(node.id, {
      x: COLUMNS.tier3.x,
      y: LANE_TOP + Math.max(0, (rawStackHeight - PRODUCT_NODE_HEIGHT) / 2),
      width: COLUMNS.tier3.width,
      height: PRODUCT_NODE_HEIGHT,
    });
  }
  return placements;
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
  const rawStackHeight =
    tier1.length * RAW_NODE_HEIGHT + Math.max(0, tier1.length - 1) * LANE_GAP;
  const stackHeight = Math.max(rawStackHeight, 220);

  const placements = new Map<string, LayoutRect>();
  for (const [id, rect] of placeRawNodes(tier1)) placements.set(id, rect);
  for (const [id, rect] of placeProcessingNodes(tier2, stackHeight)) placements.set(id, rect);
  for (const [id, rect] of placeProductNodes(tier3, stackHeight)) placements.set(id, rect);

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

    const startX = sourcePlacement.x + sourcePlacement.width;
    const endX = targetPlacement.x;

    flows.push({
      id: link.id,
      path: calculateBezierPath(startX, centerY(sourcePlacement), endX, centerY(targetPlacement), {
        bendRatio: 0.5,
      }),
      gradientId: `flow-gradient-${link.id}`,
      sourceColor: link.color,
      targetColor: target.color,
      strokeWidth: flowStrokeWidth(link.value, totalMass),
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

    const rect = {
      x: placement.x,
      y: placement.y,
      width: placement.width,
      height: placement.height,
    };
    const labelMeta = buildLabelMeta(node, rect);

    return [{
      id: node.id,
      label: node.label,
      tier: node.tier,
      color: node.color,
      sharePercent: node.sharePercent,
      rect,
      ...labelMeta,
    }];
  });

  return {
    viewBoxWidth: VIEWBOX_WIDTH,
    viewBoxHeight: VIEWBOX_HEIGHT,
    stackHeight,
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
