import { Truck } from 'lucide-react';
import { CompositionFlowchart } from '@/app/components/dpp/CompositionFlowchart';
import { compositionGraphSchema } from '@/app/domain/dpp/dppExtractionZodSchema';
import {
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
 * Rückverfolgbarkeit: zuerst Fan-in aus Kernfeld-Material (`materialComposition` / `materialZusammensetzung`),
 * sonst regulatorischer Sankey (`compositionGraph`), falls vorhanden.
 */
export function TraceabilitySection({ raw, productDisplayName }: TraceabilitySectionProps) {
  const fromReg = isRecord(raw.regulatoryExtraction)
    ? compositionGraphSchema.safeParse(raw.regulatoryExtraction.compositionGraph)
    : null;

  const materialGraph = tryMaterialCompositionToSankeyFromRaw(raw, productDisplayName);

  const regulatoryGraph =
    fromReg?.success === true && compositionGraphHasMeaningfulFlows(fromReg.data) ? fromReg.data : null;

  /** Kernfeld-Materialfluss hat Vorrang, damit „aus Materialanteilen (%)“ die Produktdaten zeigt. */
  const graph = materialGraph ?? regulatoryGraph;

  if (!graph) {
    return null;
  }

  const usedRegGraph = regulatoryGraph !== null && materialGraph === null;

  const chainSubtitle = usedRegGraph
    ? 'Herkunftskette — Lieferkette'
    : 'Herkunftskette — aus Materialanteilen (%)';

  const footnote = usedRegGraph
    ? 'Daten aus strukturierter Extraktion (Seitenbelege im regulatorischen Datensatz).'
    : 'Fluss aus den Materialprozenten im Digitalen Produktpass (Kernfelder): strukturierte materialComposition oder Textfeld materialZusammensetzung — nicht aus RAG und nicht aus der chemischen Zusammensetzung abgeleitet.';

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
      <div className="space-y-3 bg-gradient-to-b from-slate-50/60 via-white to-white px-3 pb-5 pt-5 sm:px-5 sm:pb-6 sm:pt-5">
        <CompositionFlowchart nodes={graph.nodes} links={graph.links} height={460} variant="traceability" />
        <p className="px-1 text-center text-[11px] leading-relaxed text-slate-500 sm:text-xs">{footnote}</p>
      </div>
    </section>
  );
}
