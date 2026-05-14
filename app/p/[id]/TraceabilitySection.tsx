import { Truck } from 'lucide-react';
import { CompositionFlowchart } from '@/app/components/dpp/CompositionFlowchart';
import { compositionGraphSchema } from '@/app/domain/dpp/dppExtractionZodSchema';
import {
  collectMaterialRowsForSankey,
  compositionGraphHasMeaningfulFlows,
  tryMaterialCompositionToSankeyFromRaw,
} from '@/app/domain/dpp/materialCompositionToSankey';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

type TraceabilitySectionProps = {
  /** Product passport fields (needs `regulatoryExtraction`, `materialComposition`). */
  readonly raw: Record<string, unknown>;
  readonly productDisplayName: string;
};

/**
 * Circularise-style “Traceability” block: Sankey chain-of-custody from regulatory graph
 * or a derived fan-in graph from material percentages (passport or regulatory materials).
 */
export function TraceabilitySection({ raw, productDisplayName }: TraceabilitySectionProps) {
  const fromReg = isRecord(raw.regulatoryExtraction)
    ? compositionGraphSchema.safeParse(raw.regulatoryExtraction.compositionGraph)
    : null;

  const materialGraph = tryMaterialCompositionToSankeyFromRaw(raw, productDisplayName);

  const usedRegGraph =
    fromReg?.success === true && compositionGraphHasMeaningfulFlows(fromReg.data);

  const graph = usedRegGraph ? fromReg.data : materialGraph;

  if (!graph) {
    return null;
  }

  const rows = collectMaterialRowsForSankey(raw);
  const fromRegulatoryMaterialsOnly =
    !usedRegGraph && rows.length > 0 && (!Array.isArray(raw.materialComposition) || raw.materialComposition.length === 0);

  const chainSubtitle = usedRegGraph
    ? 'Herkunftskette — Lieferkette'
    : fromRegulatoryMaterialsOnly
      ? 'Herkunftskette — Materialtabelle (regulatorisch)'
      : 'Herkunftskette — aus Materialanteilen (%)';

  const footnote = usedRegGraph
    ? 'Daten aus strukturierter Extraktion (Seitenbelege im regulatorischen Datensatz).'
    : fromRegulatoryMaterialsOnly
      ? 'Fluss aus der regulatorischen Materialzusammensetzung (Anteile laut Extraktion).'
      : 'Fluss aus den Materialprozenten im Digitalen Produktpass (Kernfelder).';

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-md ring-1 ring-slate-900/[0.04]">
      <header className="flex items-start gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-4 sm:px-5 sm:py-5">
        <div
          className="flex shrink-0 items-center justify-center rounded-xl bg-slate-900 p-2.5 text-white shadow-sm"
          aria-hidden
        >
          <Truck size={22} strokeWidth={2} />
        </div>
        <div className="min-w-0 pt-0.5">
          <h2 className="text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
            Rückverfolgbarkeit
          </h2>
          <p className="mt-1 text-[11px] font-bold uppercase leading-snug tracking-[0.18em] text-slate-500">
            {chainSubtitle}
          </p>
        </div>
      </header>
      <div className="space-y-3 bg-gradient-to-b from-slate-50/90 via-white to-white px-3 pb-5 pt-4 sm:px-5 sm:pb-6 sm:pt-5">
        <CompositionFlowchart nodes={graph.nodes} links={graph.links} height={460} variant="traceability" />
        <p className="px-1 text-center text-[11px] leading-relaxed text-slate-500 sm:text-xs">{footnote}</p>
      </div>
    </section>
  );
}
