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
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_28px_-6px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/[0.04]">
      <header className="flex items-start gap-3 bg-[#0c1929] px-5 py-4 text-white">
        <div
          className="flex shrink-0 items-center justify-center rounded-xl bg-white/[0.12] p-2.5"
          aria-hidden
        >
          <FlaskConical size={22} strokeWidth={1.75} className="text-sky-300" />
        </div>
        <div className="min-w-0 pt-0.5">
          <h2 className="text-[15px] font-semibold tracking-tight">Chemische Zusammensetzung</h2>
          <p className="mt-1 text-[11px] font-semibold uppercase leading-snug tracking-[0.14em] text-slate-400">
            Stofffluss · Konzentrationsbänder
          </p>
        </div>
      </header>
      <div className="space-y-3 overflow-x-auto bg-gradient-to-b from-sky-50/50 via-white to-white px-2 pb-5 pt-5 sm:px-4 sm:pb-6 sm:pt-5">
        <CompositionFlowchart nodes={graph.nodes} links={graph.links} height={440} variant="chemical" />
        <p className="px-1 text-center text-[11px] leading-relaxed text-slate-500 sm:text-xs">
          Flussbreiten folgen dem Mittelwert jedes angegebenen Konzentrationsbereichs (z.&nbsp;B. 40–60&nbsp;% →
          50&nbsp;%), proportional auf 100&nbsp;% skaliert. Detailtabelle mit CAS und Einstufung siehe unten.
        </p>
      </div>
    </section>
  );
}
