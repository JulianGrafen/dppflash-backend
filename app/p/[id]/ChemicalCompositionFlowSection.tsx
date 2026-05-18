'use client';

import { FlaskConical } from 'lucide-react';
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
    <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-md ring-1 ring-slate-900/[0.04]">
      <header className="flex items-start gap-3 border-b border-slate-100 bg-gradient-to-r from-violet-50/90 to-white px-4 py-4 sm:px-5 sm:py-5">
        <div
          className="flex shrink-0 items-center justify-center rounded-xl bg-violet-600 p-2.5 text-white shadow-sm"
          aria-hidden
        >
          <FlaskConical size={22} strokeWidth={2} />
        </div>
        <div className="min-w-0 pt-0.5">
          <h2 className="text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
            Chemische Zusammensetzung
          </h2>
          <p className="mt-1 text-[11px] font-bold uppercase leading-snug tracking-[0.18em] text-slate-500">
            Stofffluss — Konzentrationsbänder
          </p>
        </div>
      </header>
      <div className="space-y-3 bg-gradient-to-b from-violet-50/40 via-white to-white px-3 pb-5 pt-4 sm:px-5 sm:pb-6 sm:pt-5">
        <CompositionFlowchart nodes={graph.nodes} links={graph.links} height={440} variant="chemical" />
        <p className="px-1 text-center text-[11px] leading-relaxed text-slate-500 sm:text-xs">
          Flussbreiten folgen dem Mittelwert jedes angegebenen Konzentrationsbereichs (z.&nbsp;B. 40–60&nbsp;% →
          50&nbsp;%). Detailtabelle mit CAS und Einstufung siehe unten.
        </p>
      </div>
    </section>
  );
}
