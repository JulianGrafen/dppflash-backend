import { Truck } from 'lucide-react';
import { TraceabilityTieredFlowchart } from '@/app/components/dpp/traceability/TraceabilityTieredFlowchart';
import {
  buildPublicTierOneTraceabilityFlowFromRaw,
  buildTraceabilityTieredFlowFromRaw,
  clampTraceabilityModelToMaxTier,
} from '@/app/domain/dpp/traceability/traceabilityTieredFlowModel';

type TraceabilitySectionProps = {
  /** Product passport fields (needs `regulatoryExtraction`, `materialComposition`, `chemicalComposition`). */
  readonly raw: Record<string, unknown>;
  readonly productDisplayName: string;
  readonly maxDisclosureTier?: 1 | 2 | 3;
  /** `accordion` = body only (inside PassportAccordionPanel). */
  readonly layout?: 'card' | 'accordion';
};

/**
 * Rückverfolgbarkeit: 3-Stufen-Materialfluss (Rohstoff → Herkunft/Verarbeitung → Endprodukt).
 */
export function TraceabilitySection({
  raw,
  productDisplayName,
  maxDisclosureTier = 3,
  layout = 'card',
}: TraceabilitySectionProps) {
  const publicTierOneOnly = maxDisclosureTier === 1;
  const tieredModel = publicTierOneOnly
    ? buildPublicTierOneTraceabilityFlowFromRaw(raw, productDisplayName)
    : (() => {
        const fullTieredModel = buildTraceabilityTieredFlowFromRaw(raw, productDisplayName);
        return fullTieredModel !== null
          ? clampTraceabilityModelToMaxTier(fullTieredModel, maxDisclosureTier)
          : null;
      })();

  if (!tieredModel) {
    return null;
  }

  const chainSubtitle = publicTierOneOnly
    ? 'Öffentliche Angabe · ESPR Tier-1 Rohstoffe'
    : 'Herkunftskette — Inhaltsstoffe · Tier-1 Verarbeitung';

  const footnote = publicTierOneOnly
    ? 'Öffentlich sichtbar: Rohstoffe → Herkunftsland → Produkt (Tier-1). Detaillierte Verarbeitungsstufen sind nicht freigegeben.'
    : 'Flussbreiten folgen den deklarierten Anteilen; fehlende Anteile als „Nicht deklarationspflichtige Stoffe“. Zwischenstufe simuliert EU-/Asien-Herkunft (ESPR Tier-1).';

  const body = (
    <div className="space-y-3 overflow-x-auto pt-2">
      <TraceabilityTieredFlowchart model={tieredModel} />
      <p className="text-center text-[11px] leading-relaxed text-slate-500 sm:text-xs">{footnote}</p>
    </div>
  );

  if (layout === 'accordion') {
    return (
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{chainSubtitle}</p>
        {body}
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_28px_-6px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/[0.04]">
      <header className="flex items-start gap-3 bg-[#0c1929] px-5 py-4 text-white">
        <div
          className="flex shrink-0 items-center justify-center rounded-xl bg-white/[0.12] p-2.5"
          aria-hidden
        >
          <Truck size={22} strokeWidth={1.75} className="text-sky-300" />
        </div>
        <div className="min-w-0 pt-0.5">
          <h2 className="text-[15px] font-semibold tracking-tight">Rückverfolgbarkeit</h2>
          <p className="mt-1 text-[11px] font-semibold uppercase leading-snug tracking-[0.14em] text-slate-400">
            {chainSubtitle}
          </p>
        </div>
      </header>
      <div className="space-y-3 overflow-x-auto bg-gradient-to-b from-slate-50/60 via-white to-white px-2 pb-5 pt-5 sm:px-4 sm:pb-6 sm:pt-5">
        {body}
      </div>
    </section>
  );
}
