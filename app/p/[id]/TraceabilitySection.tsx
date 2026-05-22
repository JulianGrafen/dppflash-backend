import { Truck } from 'lucide-react';
import { CompositionFlowchart } from '@/app/components/dpp/CompositionFlowchart';
import { compositionGraphSchema } from '@/app/domain/dpp/dppExtractionZodSchema';
import {
  collectChemicalCompositionIngredientRows,
  compositionGraphHasMeaningfulFlows,
  tryChemicalCompositionToSankey,
  tryMaterialCompositionToSankeyFromRaw,
  type ChemicalIngredientListRow,
} from '@/app/domain/dpp/materialCompositionToSankey';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

type TraceabilitySectionProps = {
  /** Product passport fields (needs `regulatoryExtraction`, `materialComposition`, `chemicalComposition`). */
  readonly raw: Record<string, unknown>;
  readonly productDisplayName: string;
};

function TraceabilityIngredientTable({ rows }: { readonly rows: readonly ChemicalIngredientListRow[] }) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-col bg-white">
      <div className="border-b border-slate-100 bg-sky-50/70 px-4 py-3">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-700">
          Inhaltsstoffe (Abschnitt 3)
        </h3>
      </div>
      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
        <table className="min-w-full text-left text-[13px]">
          <thead className="sticky top-0 z-10 bg-sky-50/95 text-[11px] font-bold uppercase tracking-wider text-slate-600 backdrop-blur-sm">
            <tr>
              <th className="px-3 py-2.5">Inhaltsstoff</th>
              <th className="px-3 py-2.5 whitespace-nowrap">CAS-Nr.</th>
              <th className="px-3 py-2.5 whitespace-nowrap">Konzentration</th>
              <th className="px-3 py-2.5">Einstufung</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, i) => (
              <tr key={`${row.name}-${row.cas}-${i}`} className="bg-white align-top">
                <td className="px-3 py-2 font-semibold text-slate-900">{row.name}</td>
                <td className="px-3 py-2 whitespace-nowrap text-slate-600 tabular-nums">{row.cas}</td>
                <td className="px-3 py-2 whitespace-nowrap text-slate-600">{row.concentration}</td>
                <td className="px-3 py-2 text-slate-700">{row.classification}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Rückverfolgbarkeit: Sankey-Herkunftsfluss mit eingebetteter Inhaltsstofftabelle (Abschnitt 3).
 */
export function TraceabilitySection({ raw, productDisplayName }: TraceabilitySectionProps) {
  const fromReg = isRecord(raw.regulatoryExtraction)
    ? compositionGraphSchema.safeParse(raw.regulatoryExtraction.compositionGraph)
    : null;

  const materialGraph = tryMaterialCompositionToSankeyFromRaw(raw, productDisplayName);
  const chemicalGraph = tryChemicalCompositionToSankey(raw.chemicalComposition, productDisplayName);
  const ingredientRows = collectChemicalCompositionIngredientRows(raw.chemicalComposition);

  const regulatoryGraph =
    fromReg?.success === true && compositionGraphHasMeaningfulFlows(fromReg.data) ? fromReg.data : null;

  /** Kernfeld-Materialfluss hat Vorrang, dann Lieferkette, sonst Inhaltsstoff-Sankey. */
  const graph = materialGraph ?? regulatoryGraph ?? chemicalGraph;

  if (!graph && ingredientRows.length === 0) {
    return null;
  }

  const usedRegGraph = regulatoryGraph !== null && materialGraph === null && chemicalGraph === null;
  const usedChemicalGraph = chemicalGraph !== null && materialGraph === null && regulatoryGraph === null;
  const showIngredientTable = ingredientRows.length > 0;

  const chainSubtitle = usedRegGraph
    ? 'Herkunftskette — Lieferkette'
    : usedChemicalGraph || showIngredientTable
      ? 'Herkunftskette — Inhaltsstoffe (Abschnitt 3)'
      : 'Herkunftskette — aus Materialanteilen (%)';

  const footnote = usedRegGraph
    ? 'Daten aus strukturierter Extraktion (Seitenbelege im regulatorischen Datensatz).'
    : usedChemicalGraph || showIngredientTable
      ? 'Flussbreiten folgen dem Mittelwert jedes Konzentrationsbereichs (z. B. 40–60 % → 50 %), normalisiert auf 100 %. Stoffdetails rechts im Herkunftsfluss.'
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
        {graph && showIngredientTable ? (
          <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-inner">
            <div className="grid min-w-[720px] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-stretch">
              <div className="min-w-0 border-b border-slate-100 lg:border-b-0 lg:border-r lg:border-slate-100">
                <CompositionFlowchart
                  nodes={graph.nodes}
                  links={graph.links}
                  height={460}
                  variant="traceability"
                  className="rounded-none border-0 shadow-none"
                />
              </div>
              <TraceabilityIngredientTable rows={ingredientRows} />
            </div>
          </div>
        ) : graph ? (
          <CompositionFlowchart nodes={graph.nodes} links={graph.links} height={460} variant="traceability" />
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-inner">
            <TraceabilityIngredientTable rows={ingredientRows} />
          </div>
        )}

        {graph || showIngredientTable ? (
          <p className="px-1 text-center text-[11px] leading-relaxed text-slate-500 sm:text-xs">{footnote}</p>
        ) : null}
      </div>
    </section>
  );
}
