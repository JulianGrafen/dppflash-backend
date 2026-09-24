import { Truck } from 'lucide-react';
import { CompositionFlowchart } from '@/app/components/dpp/CompositionFlowchart';
import { TraceabilityTieredFlowchart } from '@/app/components/dpp/traceability/TraceabilityTieredFlowchart';
import { tryTraceabilitySankeyFromRaw } from '@/app/domain/dpp/materialCompositionToSankey';
import {
  buildTraceabilityTieredFlowFromRaw,
  clampTraceabilityModelToMaxTier,
} from '@/app/domain/dpp/traceability/traceabilityTieredFlowModel';
import { TraceabilityTierOneList } from './TraceabilityTierOneList';

type TraceabilitySectionProps = {
  /** Product passport fields (needs `regulatoryExtraction`, `materialComposition`, `chemicalComposition`). */
  readonly raw: Record<string, unknown>;
  readonly productDisplayName: string;
  readonly maxDisclosureTier?: 1 | 2 | 3;
};

/**
 * Rückverfolgbarkeit: 3-Stufen-Materialfluss (Rohstoff → Herkunft/Verarbeitung → Endprodukt).
 */
export function TraceabilitySection({
  raw,
  productDisplayName,
  maxDisclosureTier = 3,
}: TraceabilitySectionProps) {
  const fullTieredModel = buildTraceabilityTieredFlowFromRaw(raw, productDisplayName);
  const tieredModel =
    fullTieredModel !== null
      ? clampTraceabilityModelToMaxTier(fullTieredModel, maxDisclosureTier)
      : null;
  const { graph, source } = tryTraceabilitySankeyFromRaw(raw, productDisplayName);

  if (!tieredModel && !graph) {
    return null;
  }

  const publicTierOneOnly = maxDisclosureTier === 1 && tieredModel !== null;
  const usesTieredFlow = tieredModel !== null && !publicTierOneOnly;

  const chainSubtitle =
    publicTierOneOnly
      ? 'Öffentliche Angabe · ESPR Tier-1 Rohstoffe'
      : source === 'regulatory' && !usesTieredFlow
        ? 'Herkunftskette — Lieferkette'
        : usesTieredFlow
          ? 'Herkunftskette — Inhaltsstoffe · Tier-1 Verarbeitung'
          : 'Herkunftskette — aus Materialanteilen (%)';

  const footnote =
    publicTierOneOnly
      ? 'Öffentlich sichtbar sind nur Rohstoffanteile (Tier-1). Verarbeitungs- und Endproduktstufen sind in diesem Pass nicht freigegeben.'
      : source === 'regulatory' && !usesTieredFlow
        ? 'Daten aus strukturierter Extraktion (Seitenbelege im regulatorischen Datensatz).'
        : usesTieredFlow
          ? 'Flussbreiten folgen den SDB-Mittelwerten; fehlende Anteile als „Nicht deklarationspflichtige Stoffe“. Zwischenstufe simuliert EU-/Asien-Herkunft (ESPR Tier-1).'
          : 'Fluss aus den Materialprozenten im Digitalen Produktpass (Kernfelder): strukturierte materialComposition oder Textfeld materialZusammensetzung.';

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
        {publicTierOneOnly && tieredModel ? (
          <TraceabilityTierOneList model={tieredModel} />
        ) : tieredModel ? (
          <TraceabilityTieredFlowchart model={tieredModel} />
        ) : graph ? (
          <CompositionFlowchart nodes={graph.nodes} links={graph.links} height={460} variant="traceability" />
        ) : null}
        <p className="px-1 text-center text-[11px] leading-relaxed text-slate-500 sm:text-xs">{footnote}</p>
      </div>
    </section>
  );
}
