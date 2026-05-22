'use client';

import { useMemo, useState } from 'react';
import type { TraceabilityTieredFlowModel } from '@/app/domain/dpp/traceability/traceabilityTieredFlowModel';
import {
  computeTraceabilityTieredLayout,
  formatTraceabilityFlowTooltip,
  formatTraceabilityNodeTooltip,
  type LayoutFlow,
  type LayoutNode,
} from '@/app/domain/dpp/traceability/computeTraceabilityTieredLayout';

type TraceabilityTieredFlowchartProps = {
  readonly model: TraceabilityTieredFlowModel;
  readonly className?: string;
};

type HoverState =
  | { readonly kind: 'node'; readonly node: LayoutNode }
  | { readonly kind: 'flow'; readonly flow: LayoutFlow }
  | null;

const HEADER_HEIGHT = 72;
const LINE_HEIGHT = 13;
const PERCENT_LINE_HEIGHT = 12;
const MIN_BAND_VISUAL = 32;

const GRADIENT_COLUMNS = {
  tier1BarEnd: 288 + 32,
  tier3BarStart: 860,
} as const;

function formatPercentBadge(value: number): string {
  if (Number.isInteger(value)) {
    return `${value} %`;
  }
  return `${value.toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`;
}

function labelStartY(node: LayoutNode): number {
  const textBlockHeight = node.labelLines.length * LINE_HEIGHT + PERCENT_LINE_HEIGHT;
  return node.labelRect.y + Math.max(8, (node.labelRect.height - textBlockHeight) / 2);
}

function minCardHeight(node: LayoutNode): number {
  return node.labelLines.length * LINE_HEIGHT + PERCENT_LINE_HEIGHT + 16;
}

function NodeLabel({ node }: { readonly node: LayoutNode }) {
  const startY = labelStartY(node);
  const textX =
    node.labelAnchor === 'end'
      ? node.labelRect.x + node.labelRect.width
      : node.labelRect.x;
  const showCard = node.tier === 2 || node.tier === 3;

  return (
    <g className="traceability-label">
      {showCard ? (
        <rect
          x={node.labelRect.x - 8}
          y={node.labelRect.y + 4}
          width={node.labelRect.width + 12}
          height={Math.max(node.labelRect.height - 8, minCardHeight(node))}
          rx={10}
          fill="#ffffff"
          stroke="#e2e8f0"
          strokeWidth={1}
        />
      ) : null}
      <text
        x={textX}
        y={startY}
        textAnchor={node.labelAnchor}
        fill={node.tier === 1 ? '#0f172a' : '#1e293b'}
        fontSize={11}
        fontWeight={600}
      >
        {node.labelLines.map((line, index) => (
          <tspan key={`${node.id}-line-${index}`} x={textX} dy={index === 0 ? 0 : LINE_HEIGHT}>
            {line}
          </tspan>
        ))}
        <tspan
          x={textX}
          dy={LINE_HEIGHT + 2}
          fill="#64748b"
          fontSize={10}
          fontWeight={700}
        >
          {formatPercentBadge(node.sharePercent)}
        </tspan>
      </text>
    </g>
  );
}

function FlowBand({
  flow,
  onHover,
}: {
  readonly flow: LayoutFlow;
  readonly onHover: (flow: LayoutFlow | null) => void;
}) {
  return (
    <path
      d={flow.path}
      fill={`url(#${flow.gradientId})`}
      stroke="#ffffff"
      strokeOpacity={0.35}
      strokeWidth={0.75}
      opacity={0.88}
      onMouseEnter={() => onHover(flow)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(flow)}
      onBlur={() => onHover(null)}
      tabIndex={0}
      aria-label={formatTraceabilityFlowTooltip(flow)}
      className="transition-opacity hover:opacity-100 focus:opacity-100 focus:outline-none"
    />
  );
}

function NodeBar({
  node,
  onHover,
}: {
  readonly node: LayoutNode;
  readonly onHover: (node: LayoutNode | null) => void;
}) {
  const { rect } = node;

  return (
    <g
      onMouseEnter={() => onHover(node)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(node)}
      onBlur={() => onHover(null)}
      tabIndex={0}
      aria-label={formatTraceabilityNodeTooltip(node)}
      className="focus:outline-none"
    >
      <rect
        x={rect.x - 1}
        y={rect.y - 1}
        width={rect.width + 2}
        height={Math.max(rect.height, MIN_BAND_VISUAL)}
        rx={node.tier === 3 ? 10 : 6}
        fill={node.color}
        fillOpacity={node.tier === 3 ? 0.95 : 0.9}
        stroke="#ffffff"
        strokeWidth={1.5}
      />
    </g>
  );
}

/**
 * **ESPR-Rückverfolgbarkeit** — 3-Spalten-Materialfluss mit externen Labels (ohne Überlappung).
 */
export function TraceabilityTieredFlowchart({ model, className = '' }: TraceabilityTieredFlowchartProps) {
  const layout = useMemo(() => computeTraceabilityTieredLayout(model), [model]);
  const [hover, setHover] = useState<HoverState>(null);

  const tooltipText =
    hover?.kind === 'node'
      ? formatTraceabilityNodeTooltip(hover.node)
      : hover?.kind === 'flow'
        ? formatTraceabilityFlowTooltip(hover.flow)
        : null;

  const sortedNodes = useMemo(
    () => [...layout.nodes].sort((a, b) => a.rect.y - b.rect.y || a.tier - b.tier),
    [layout.nodes],
  );

  return (
    <div className={`relative w-full min-w-0 ${className}`}>
      <div className="overflow-x-auto rounded-xl border border-slate-200/90 bg-gradient-to-b from-slate-50/80 to-white shadow-inner">
        <svg
          viewBox={`0 0 ${layout.viewBoxWidth} ${layout.viewBoxHeight}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Rückverfolgbarkeits-Materialfluss mit Herkunftsstufe"
          className="h-auto w-full min-w-[920px]"
        >
          <defs>
            {layout.flows.map((flow) => (
              <linearGradient
                key={flow.gradientId}
                id={flow.gradientId}
                gradientUnits="userSpaceOnUse"
                x1={GRADIENT_COLUMNS.tier1BarEnd}
                y1={0}
                x2={GRADIENT_COLUMNS.tier3BarStart}
                y2={0}
              >
                <stop offset="0%" stopColor={flow.sourceColor} stopOpacity={0.55} />
                <stop offset="100%" stopColor={flow.targetColor} stopOpacity={0.5} />
              </linearGradient>
            ))}
          </defs>

          <rect x={0} y={0} width={layout.viewBoxWidth} height={HEADER_HEIGHT} fill="#f8fafc" />

          {layout.columnLabels.map((column) => (
            <text
              key={column.label}
              x={column.x}
              y={46}
              fill="#475569"
              fontSize={10}
              fontWeight={700}
              letterSpacing="0.14em"
              style={{ textTransform: 'uppercase' }}
            >
              {column.label}
            </text>
          ))}

          {layout.flows.map((flow) => (
            <FlowBand
              key={flow.id}
              flow={flow}
              onHover={(next) => setHover(next ? { kind: 'flow', flow: next } : null)}
            />
          ))}

          {sortedNodes.map((node) => (
            <NodeBar
              key={`bar-${node.id}`}
              node={node}
              onHover={(next) => setHover(next ? { kind: 'node', node: next } : null)}
            />
          ))}

          {sortedNodes.map((node) => (
            <NodeLabel key={`label-${node.id}`} node={node} />
          ))}
        </svg>
      </div>

      {tooltipText ? (
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 max-w-[min(92%,30rem)] -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-center text-[11px] font-medium leading-snug text-white shadow-lg">
          {tooltipText}
        </div>
      ) : null}
    </div>
  );
}
