'use client';

import { useMemo } from 'react';
import { ResponsiveSankey } from '@nivo/sankey';
import type { CompositionGraphLinkPayload, CompositionGraphNodePayload } from '@/app/domain/dpp/dppExtractionZodSchema';

const CATEGORY_COLORS: Record<CompositionGraphNodePayload['category'], string> = {
  raw_material: '#059669',
  processing: '#2563eb',
  final_product: '#7c3aed',
};

export interface CompositionFlowchartProps {
  readonly nodes: readonly CompositionGraphNodePayload[];
  readonly links: readonly CompositionGraphLinkPayload[];
  /** Chart height in pixels (width follows container). */
  readonly height?: number;
  readonly className?: string;
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
}: CompositionFlowchartProps) {
  const data = useMemo(() => {
    const safeLinks = links.map((l) => ({
      ...l,
      value: l.value <= 0 ? 0.0001 : l.value,
    }));
    return { nodes: [...nodes], links: safeLinks };
  }, [nodes, links]);

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
        margin={{ top: 24, right: 160, bottom: 24, left: 48 }}
        align="justify"
        sort="input"
        layout="horizontal"
        nodeOpacity={1}
        nodeHoverOpacity={1}
        nodeThickness={18}
        nodeInnerPadding={3}
        nodeSpacing={24}
        nodeBorderWidth={0}
        linkOpacity={0.45}
        linkHoverOpacity={0.7}
        linkContract={3}
        enableLinkGradient
        labelPosition="outside"
        labelOrientation="horizontal"
        labelPadding={12}
        labelTextColor={{ from: 'color', modifiers: [['darker', 1.6]] }}
        colors={(node) => CATEGORY_COLORS[node.category] ?? '#64748b'}
        theme={{
          labels: { text: { fontSize: 11, fontWeight: 500, fill: '#334155' } },
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
