'use client';

import { useMemo } from 'react';
import { ResponsiveSankey } from '@nivo/sankey';
import type { CompositionGraphLinkPayload, CompositionGraphNodePayload } from '@/app/domain/dpp/dppExtractionZodSchema';

const CATEGORY_COLORS: Record<CompositionGraphNodePayload['category'], string> = {
  raw_material: '#059669',
  processing: '#2563eb',
  final_product: '#7c3aed',
};

/** Traceability view: multi-hue flows (reference-style chain of custody). */
const TRACEABILITY_NODE_COLORS = [
  '#0f766e',
  '#059669',
  '#2563eb',
  '#4f46e5',
  '#7c3aed',
  '#c026d3',
  '#db2777',
  '#d97706',
];

export type CompositionFlowchartVariant = 'default' | 'traceability';

export interface CompositionFlowchartProps {
  readonly nodes: readonly CompositionGraphNodePayload[];
  readonly links: readonly CompositionGraphLinkPayload[];
  /** Chart height in pixels (width follows container). */
  readonly height?: number;
  readonly className?: string;
  readonly variant?: CompositionFlowchartVariant;
}

type SankeyNode = CompositionGraphNodePayload;
type SankeyLink = CompositionGraphLinkPayload;

/**
 * Responsive Sankey for material / process composition (ESPR-style compositionGraph).
 */
export function CompositionFlowchart({
  nodes,
  links,
  height = 420,
  className = '',
  variant = 'default',
}: CompositionFlowchartProps) {
  const data = useMemo(() => {
    const safeLinks = links.map((l) => ({
      ...l,
      value: l.value <= 0 ? 0.0001 : l.value,
    }));
    return { nodes: [...nodes], links: safeLinks };
  }, [nodes, links]);

  const isTrace = variant === 'traceability';

  const nodeColor = useMemo(() => {
    if (!isTrace) {
      return (node: { id: string; category?: SankeyNode['category'] }) =>
        CATEGORY_COLORS[node.category ?? 'processing'] ?? '#64748b';
    }
    const idToIndex = new Map(data.nodes.map((n, i) => [n.id, i]));
    return (node: { id: string }) =>
      TRACEABILITY_NODE_COLORS[(idToIndex.get(node.id) ?? 0) % TRACEABILITY_NODE_COLORS.length] ?? '#64748b';
  }, [data.nodes, isTrace]);

  if (nodes.length < 2 || links.length === 0) {
    return (
      <div
        className={`flex min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-4 text-center text-sm text-slate-600 ${className}`}
      >
        Kein gültiger Flussgraph (mindestens zwei Knoten und eine Verbindung erforderlich).
      </div>
    );
  }

  return (
    <div
      className={`w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm ${className}`}
      style={{ height }}
    >
      <ResponsiveSankey<SankeyNode, SankeyLink>
        data={data}
        margin={
          isTrace
            ? { top: 28, right: 200, bottom: 28, left: 64 }
            : { top: 24, right: 160, bottom: 24, left: 48 }
        }
        align="justify"
        sort="input"
        layout="horizontal"
        nodeOpacity={1}
        nodeHoverOpacity={1}
        nodeThickness={isTrace ? 24 : 18}
        nodeInnerPadding={isTrace ? 4 : 3}
        nodeSpacing={isTrace ? 28 : 24}
        nodeBorderWidth={0}
        linkOpacity={isTrace ? 0.5 : 0.45}
        linkHoverOpacity={isTrace ? 0.72 : 0.7}
        linkContract={isTrace ? 2 : 3}
        enableLinkGradient
        labelPosition="outside"
        labelOrientation="horizontal"
        labelPadding={isTrace ? 14 : 12}
        labelTextColor={{ from: 'color', modifiers: [['darker', isTrace ? 1.9 : 1.6]] }}
        colors={nodeColor}
        theme={{
          labels: { text: { fontSize: isTrace ? 12 : 11, fontWeight: 600, fill: '#0f172a' } },
          tooltip: {
            container: {
              background: '#0f172a',
              color: '#f8fafc',
              fontSize: 12,
              borderRadius: 8,
              padding: '8px 12px',
            },
          },
        }}
        motionConfig="gentle"
      />
    </div>
  );
}
