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

function TierNode({ node }: { readonly node: LayoutNode }) {
  const { rect } = node;
  const isProduct = node.tier === 3;
  const isProcessing = node.tier === 2;

  return (
    <g className="traceability-node">
      <rect
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={Math.max(rect.height, 6)}
        rx={isProduct ? 12 : 8}
        fill={node.color}
        fillOpacity={isProduct ? 0.95 : isProcessing ? 0.9 : 0.88}
        stroke={isProduct ? '#5b21b6' : '#0f172a'}
        strokeOpacity={0.12}
        strokeWidth={1}
      />
      <foreignObject
        x={rect.x + 8}
        y={rect.y + 6}
        width={Math.max(rect.width - 16, 40)}
        height={Math.max(rect.height - 12, 20)}
      >
        <div
          className={`flex h-full items-center text-[11px] font-semibold leading-snug ${
            isProduct || isProcessing ? 'text-white' : 'text-slate-900'
          }`}
        >
          <span className="line-clamp-3">{node.label}</span>
        </div>
      </foreignObject>
    </g>
  );
}

/**
 * **ESPR-Rückverfolgbarkeit** — 3-Spalten-Materialfluss (Rohstoff → Herkunft → Produkt) als responsives SVG.
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

  return (
    <div className={`relative w-full min-w-0 ${className}`}>
      <div className="overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-inner">
        <svg
          viewBox={`0 0 ${layout.viewBoxWidth} ${layout.viewBoxHeight}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Rückverfolgbarkeits-Materialfluss mit Herkunftsstufe"
          className="h-auto w-full min-w-[720px]"
        >
          <defs>
            {layout.flows.map((flow) => (
              <linearGradient
                key={flow.gradientId}
                id={flow.gradientId}
                gradientUnits="userSpaceOnUse"
                x1={0}
                y1={0}
                x2={layout.viewBoxWidth}
                y2={0}
              >
                <stop offset="0%" stopColor={flow.sourceColor} stopOpacity={0.62} />
                <stop offset="100%" stopColor={flow.targetColor} stopOpacity={0.58} />
              </linearGradient>
            ))}
          </defs>

          {layout.columnLabels.map((column) => (
            <text
              key={column.label}
              x={column.x}
              y={42}
              fill="#64748b"
              fontSize={11}
              fontWeight={700}
              letterSpacing="0.12em"
              style={{ textTransform: 'uppercase' }}
            >
              {column.label}
            </text>
          ))}

          {layout.flows.map((flow) => (
            <path
              key={flow.id}
              d={flow.path}
              fill={`url(#${flow.gradientId})`}
              stroke="none"
              opacity={0.92}
              onMouseEnter={() => setHover({ kind: 'flow', flow })}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover({ kind: 'flow', flow })}
              onBlur={() => setHover(null)}
              tabIndex={0}
              aria-label={formatTraceabilityFlowTooltip(flow)}
            />
          ))}

          {layout.nodes.map((node) => (
            <g
              key={node.id}
              onMouseEnter={() => setHover({ kind: 'node', node })}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover({ kind: 'node', node })}
              onBlur={() => setHover(null)}
              tabIndex={0}
              aria-label={formatTraceabilityNodeTooltip(node)}
            >
              <TierNode node={node} />
            </g>
          ))}
        </svg>
      </div>

      {tooltipText ? (
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 max-w-[min(90%,28rem)] -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-center text-[11px] font-medium leading-snug text-white shadow-lg">
          {tooltipText}
        </div>
      ) : null}
    </div>
  );
}
