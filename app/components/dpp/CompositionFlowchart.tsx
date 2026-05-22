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

const CATEGORY_LABELS: Record<CompositionGraphNodePayload['category'], string> = {
  raw_material: 'Rohstoff / Material',
  processing: 'Verarbeitung',
  final_product: 'Endprodukt',
};

export type CompositionFlowchartVariant = 'default' | 'traceability' | 'chemical';

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

const TOOLTIP_STYLE: React.CSSProperties = {
  background: '#0f172a',
  color: '#f8fafc',
  fontSize: 12,
  borderRadius: 8,
  padding: '8px 12px',
  maxWidth: 320,
  lineHeight: 1.45,
  wordBreak: 'break-word',
};

/** Schätzt benötigten Seitenrand aus der längsten Bezeichnung (ca. 7px pro Zeichen bei 12px). */
function estimateSideMargin(labels: readonly string[], fontSize: number): number {
  const maxLen = Math.max(8, ...labels.map((l) => l.length));
  const cappedLen = Math.min(maxLen, 56);
  return Math.min(380, Math.max(112, Math.ceil(cappedLen * fontSize * 0.62 + 40)));
}

function computeSankeyLayout(
  nodes: readonly CompositionGraphNodePayload[],
  baseHeight: number,
  isTraceStyle: boolean,
): {
  readonly height: number;
  readonly margin: { readonly top: number; readonly right: number; readonly bottom: number; readonly left: number };
  readonly minWidth: number;
} {
  const fontSize = isTraceStyle ? 12 : 11;
  const labels = nodes.map((n) => n.label);
  const side = estimateSideMargin(labels, fontSize);
  const height = Math.max(baseHeight, nodes.length * (isTraceStyle ? 56 : 48) + 96);
  const margin = {
    top: 40,
    right: side,
    bottom: 40,
    left: side,
  };
  return {
    height,
    margin,
    minWidth: margin.left + margin.right + 280,
  };
}

/** Kürzt nur am Wortende — voller Text bleibt im Tooltip. */
function formatSankeyNodeLabel(label: string, maxChars = 44): string {
  const trimmed = label.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }
  const slice = trimmed.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace >= Math.floor(maxChars * 0.45)) {
    return `${trimmed.slice(0, lastSpace)} …`;
  }
  return `${slice.trimEnd()} …`;
}

function formatFlowPercent(value: number): string {
  if (Number.isInteger(value)) {
    return `${value} %`;
  }
  return `${value.toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`;
}

function resolveLinkEndpointLabel(
  endpoint: { readonly id: string },
  labelById: ReadonlyMap<string, string>,
): string {
  return labelById.get(endpoint.id) ?? endpoint.id;
}

function renderSankeyLinkTooltip({
  link,
  labelById,
  percentCaption,
}: {
  readonly link: { readonly source: { readonly id: string }; readonly target: { readonly id: string }; readonly value: number };
  readonly labelById: ReadonlyMap<string, string>;
  readonly percentCaption: string;
}) {
  const sourceLabel = resolveLinkEndpointLabel(link.source, labelById);
  const targetLabel = resolveLinkEndpointLabel(link.target, labelById);
  return (
    <div style={TOOLTIP_STYLE}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{sourceLabel}</div>
      <div style={{ opacity: 0.9 }}>→ {targetLabel}</div>
      <div style={{ marginTop: 6, fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>
        {formatFlowPercent(link.value)}
      </div>
      <div style={{ marginTop: 2, fontSize: 11, opacity: 0.75 }}>{percentCaption}</div>
    </div>
  );
}

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

  /** Gleiche Sankey-Optik wie Rückverfolgbarkeit (Referenz-UI); inkl. chemische Zusammensetzung. */
  const isTraceStyle = variant === 'traceability' || variant === 'chemical';

  const layout = useMemo(
    () => computeSankeyLayout(nodes, height, isTraceStyle),
    [nodes, height, isTraceStyle],
  );

  const labelById = useMemo(
    () => new Map(data.nodes.map((n) => [n.id, n.label] as const)),
    [data.nodes],
  );

  const outboundPercentByNodeId = useMemo(() => {
    const totals = new Map<string, number>();
    for (const link of data.links) {
      totals.set(link.source, (totals.get(link.source) ?? 0) + link.value);
    }
    return totals;
  }, [data.links]);

  const nodeColor = useMemo(() => {
    if (!isTraceStyle) {
      return (node: { id: string; category?: SankeyNode['category'] }) =>
        CATEGORY_COLORS[node.category ?? 'processing'] ?? '#64748b';
    }
    const idToIndex = new Map(data.nodes.map((n, i) => [n.id, i]));
    return (node: { id: string }) =>
      TRACEABILITY_NODE_COLORS[(idToIndex.get(node.id) ?? 0) % TRACEABILITY_NODE_COLORS.length] ?? '#64748b';
  }, [data.nodes, isTraceStyle]);

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
    <div className={`w-full min-w-0 overflow-x-auto ${className}`}>
      <div
        className="rounded-xl border border-slate-200/90 bg-white shadow-inner"
        style={{ height: layout.height, minWidth: layout.minWidth }}
      >
        <ResponsiveSankey<SankeyNode, SankeyLink>
          data={data}
          isInteractive
          label={(node) => formatSankeyNodeLabel(labelById.get(node.id) ?? node.id)}
          margin={layout.margin}
          align="justify"
          sort="input"
          layout="horizontal"
          nodeOpacity={1}
          nodeHoverOpacity={1}
          nodeThickness={isTraceStyle ? 22 : 18}
          nodeInnerPadding={isTraceStyle ? 5 : 3}
          nodeSpacing={isTraceStyle ? 32 : 26}
          nodeBorderWidth={0}
          linkOpacity={isTraceStyle ? 0.5 : 0.45}
          linkHoverOpacity={isTraceStyle ? 0.72 : 0.7}
          linkContract={isTraceStyle ? 2 : 3}
          enableLinkGradient
          labelPosition="outside"
          labelOrientation="horizontal"
          labelPadding={isTraceStyle ? 18 : 14}
          labelTextColor="#0f172a"
          colors={nodeColor}
          theme={{
            labels: {
              text: {
                fontSize: isTraceStyle ? 12 : 11,
                fontWeight: 600,
                fill: '#0f172a',
              },
            },
            tooltip: {
              container: TOOLTIP_STYLE,
            },
          }}
          motionConfig="gentle"
          nodeTooltip={({ node }) => {
            const fullLabel = labelById.get(node.id) ?? node.id;
            const category = data.nodes.find((n) => n.id === node.id)?.category;
            const outbound = outboundPercentByNodeId.get(node.id);
            return (
              <div style={TOOLTIP_STYLE}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{fullLabel}</div>
                {category ? (
                  <div style={{ opacity: 0.85 }}>{CATEGORY_LABELS[category] ?? category}</div>
                ) : null}
                {outbound !== undefined && (variant === 'chemical' || variant === 'traceability') ? (
                  <div style={{ marginTop: 6, fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>
                    {formatFlowPercent(outbound)}
                  </div>
                ) : null}
              </div>
            );
          }}
          linkTooltip={
            variant === 'traceability'
              ? ({ link }) =>
                  renderSankeyLinkTooltip({
                    link,
                    labelById,
                    percentCaption: 'Anteil laut Produktpass',
                  })
              : variant === 'chemical'
                ? ({ link }) =>
                    renderSankeyLinkTooltip({
                      link,
                      labelById,
                      percentCaption: 'Mittelwert des Konzentrationsbands (geschätzt)',
                    })
                : ({ link }) =>
                    renderSankeyLinkTooltip({
                      link,
                      labelById,
                      percentCaption: 'Anteil',
                    })
          }
        />
      </div>
    </div>
  );
}
