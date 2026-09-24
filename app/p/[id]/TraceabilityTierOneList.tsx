import type { TraceabilityTieredFlowModel } from '@/app/domain/dpp/traceability/traceabilityTieredFlowModel';

type TraceabilityTierOneListProps = {
  readonly model: TraceabilityTieredFlowModel;
};

function formatPercent(value: number): string {
  if (Number.isInteger(value)) {
    return `${value} %`;
  }
  return `${value.toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`;
}

/**
 * Public Tier-1 disclosure: raw materials only (no processing / end-product flow).
 */
export function TraceabilityTierOneList({ model }: TraceabilityTierOneListProps) {
  const materials = model.nodes.filter((node) => node.tier === 1);

  if (materials.length === 0) {
    return null;
  }

  return (
    <ul className="mx-auto max-w-lg space-y-2 px-2 sm:px-4">
      {materials.map((node) => (
        <li
          key={node.id}
          className="flex items-center justify-between gap-4 rounded-xl border border-slate-200/90 bg-white px-4 py-3 shadow-sm"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span
              className="h-3 w-3 shrink-0 rounded-full ring-2 ring-white"
              style={{ backgroundColor: node.color }}
              aria-hidden
            />
            <span className="text-sm font-medium text-slate-800">{node.label}</span>
          </span>
          <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-600">
            {formatPercent(node.sharePercent)}
          </span>
        </li>
      ))}
    </ul>
  );
}
