import type { MassBalanceSegment } from '@/app/domain/dpp/chemicalMassBalance';

const SEGMENT_COLORS = [
  '#0f766e',
  '#2563eb',
  '#7c3aed',
  '#c026d3',
  '#d97706',
  '#0891b2',
] as const;

const FILLER_COLOR = '#94a3b8';

function formatSharePercent(value: number): string {
  if (Math.abs(value - Math.round(value)) < 0.05) {
    return `${Math.round(value)} %`;
  }
  return `${value.toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`;
}

function segmentColor(segment: MassBalanceSegment, index: number): string {
  if (segment.isCalculatedFiller) {
    return FILLER_COLOR;
  }
  return SEGMENT_COLORS[index % SEGMENT_COLORS.length] ?? '#64748b';
}

type MassBalanceStackedBarProps = {
  readonly segments: readonly MassBalanceSegment[];
};

/**
 * **Nativer Materialfluss-Balken** — 100 % Stacked Bar ohne Chart-Bibliothek (Flexbox).
 */
export function MassBalanceStackedBar({ segments }: MassBalanceStackedBarProps) {
  if (segments.length === 0) {
    return null;
  }

  return (
    <div className="px-1">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-700">
          Materialfluss · Massenbilanz 100 %
        </h3>
        <p className="text-[11px] text-slate-500">
          Konzentrationsbänder → Mittelwert · fehlende Masse = Füllstoff
        </p>
      </div>

      <div
        className="flex h-11 w-full overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200/90"
        role="img"
        aria-label="Materialfluss-Massenbilanz 100 Prozent"
      >
        {segments.map((segment, index) => {
          const widthPct = Math.max(segment.sharePercent, segment.sharePercent > 0 ? 0.6 : 0);
          const color = segmentColor(segment, index);
          const title = `${segment.label}: ${formatSharePercent(segment.sharePercent)}${
            segment.sourceConcentration ? ` (SDB: ${segment.sourceConcentration})` : ''
          }`;

          return (
            <div
              key={segment.id}
              className={`relative h-full min-w-[3px] transition-opacity hover:opacity-90 ${
                segment.isCalculatedFiller ? 'bg-[repeating-linear-gradient(135deg,#94a3b8_0_6px,#cbd5e1_6px_12px)]' : ''
              }`}
              style={{
                width: `${widthPct}%`,
                backgroundColor: segment.isCalculatedFiller ? undefined : color,
              }}
              title={title}
            >
              {segment.sharePercent >= 8 ? (
                <span className="absolute inset-0 flex items-center justify-center px-1 text-center text-[10px] font-semibold leading-none text-white drop-shadow-sm">
                  {formatSharePercent(segment.sharePercent)}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
        {segments.map((segment, index) => (
          <li key={`legend-${segment.id}`} className="flex min-w-0 items-start gap-2.5 text-[12px]">
            <span
              className={`mt-0.5 h-3 w-3 shrink-0 rounded-sm ring-1 ring-slate-200/80 ${
                segment.isCalculatedFiller
                  ? 'bg-[repeating-linear-gradient(135deg,#94a3b8_0_4px,#cbd5e1_4px_8px)]'
                  : ''
              }`}
              style={
                segment.isCalculatedFiller
                  ? undefined
                  : { backgroundColor: segmentColor(segment, index) }
              }
              aria-hidden
            />
            <div className="min-w-0">
              <p className="font-semibold leading-snug text-slate-900">{segment.label}</p>
              <p className="mt-0.5 tabular-nums text-slate-600">{formatSharePercent(segment.sharePercent)}</p>
              {segment.sourceConcentration ? (
                <p className="mt-0.5 text-[11px] text-slate-500">SDB: {segment.sourceConcentration}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
