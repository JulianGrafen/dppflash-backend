'use client';

import { CompositionFlowchart } from '@/app/components/dpp/CompositionFlowchart';
import type { CompositionGraphPayload } from '@/app/domain/dpp/dppExtractionZodSchema';

type ChemicalCompositionFlowSectionProps = {
  readonly graph: CompositionGraphPayload;
};

/**
 * Sankey: Inhaltsstoffe → Produkt (Gewichtung aus Mittelwerten der Konzentrationsbänder).
 */
export function ChemicalCompositionFlowSection({ graph }: ChemicalCompositionFlowSectionProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_28px_-6px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/[0.04]">
      <div className="space-y-3 bg-gradient-to-b from-sky-50/50 via-white to-white px-3 pb-5 pt-5 sm:px-5 sm:pb-6 sm:pt-5">
        <CompositionFlowchart nodes={graph.nodes} links={graph.links} height={440} variant="chemical" />
        <p className="px-1 text-center text-[11px] leading-relaxed text-slate-500 sm:text-xs">
          Flussbreiten folgen dem Mittelwert jedes angegebenen Konzentrationsbereichs (z.&nbsp;B. 40–60&nbsp;% →
          50&nbsp;%). Detailtabelle mit CAS und Einstufung siehe unten.
        </p>
      </div>
    </section>
  );
}
