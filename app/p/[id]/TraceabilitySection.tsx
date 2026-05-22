import { Truck } from 'lucide-react';
import { MassBalanceStackedBar } from '@/app/components/dpp/MassBalanceStackedBar';
import { CompositionFlowchart } from '@/app/components/dpp/CompositionFlowchart';
import { buildChemicalMassBalanceSegments } from '@/app/domain/dpp/chemicalMassBalance';
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
  readonly raw: Record<string, unknown>;
  readonly productDisplayName: string;
};

function TraceabilityIngredientTable({ rows }: { readonly rows: readonly ChemicalIngredientListRow[] }) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-slate-200/70 pt-4">
      <h3 className="px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-700">
        Inhaltsstoffe (Abschnitt 3)
      </h3>
      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200/80 bg-white/90">
        <table className="min-w-full text-left text-[13px]">
          <thead className="bg-sky-50/90 text-[11px] font-bold uppercase tracking-wider text-slate-600">
            <tr>
              <th className="px-3 py-2.5">Inhaltsstoff</th>
              <th className="px-3 py-2.5 whitespace-nowrap">CAS-Nr.</th>
              <th className="px-3 py-2.5 whitespace-nowrap">Konzentration</th>
              <th className="px-3 py-2.5">Einstufung</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, i) => (
              <tr key={`${row.name}-${row.cas}-${i}`} className="bg-white">
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
 * Rückverfolgbarkeit: **Massenbilanz-Materialfluss** (CSS-Stacked-Bar) + Inhaltsstofftabelle.
 */
export function TraceabilitySection({ raw, productDisplayName }: TraceabilitySectionProps) {
  const fromReg = isRecord(raw.regulatoryExtraction)
    ? compositionGraphSchema.safeParse(raw.regulatoryExtraction.compositionGraph)
    : null;

  const materialGraph = tryMaterialCompositionToSankeyFromRaw(raw, productDisplayName);
  const chemicalGraph = tryChemicalCompositionToSankey(raw.chemicalComposition, productDisplayName);
  const ingredientRows = collectChemicalCompositionIngredientRows(raw.chemicalComposition);
  const massBalanceSegments = buildChemicalMassBalanceSegments(raw.chemicalComposition);

  const regulatoryGraph =
    fromReg?.success === true && compositionGraphHasMeaningfulFlows(fromReg.data) ? fromReg.data : null;

  const hasIngredientOrigin = ingredientRows.length > 0;
  const hasMassBalance = massBalanceSegments !== null && massBalanceSegments.length > 0;

  const graph =
    hasIngredientOrigin || hasMassBalance
      ? null
      : (materialGraph ?? regulatoryGraph ?? chemicalGraph);

  if (!graph && !hasIngredientOrigin && !hasMassBalance) {
    return null;
  }

  const usedRegGraph = graph === regulatoryGraph;
  const usedMaterialGraph = graph === materialGraph;

  const chainSubtitle = hasMassBalance || hasIngredientOrigin
    ? 'Herkunftskette — Inhaltsstoffe (Abschnitt 3)'
    : usedRegGraph
      ? 'Herkunftskette — Lieferkette'
      : usedMaterialGraph
        ? 'Herkunftskette — aus Materialanteilen (%)'
        : 'Herkunftskette';

  const footnote = hasMassBalance
    ? 'Massenbilanz aus Konzentrations-Mittelwerten (z. B. 40–60 % → 50 %). Nicht deklarierte Anteile werden als Füllstoff ergänzt, bis exakt 100 % erreicht sind.'
    : usedRegGraph
      ? 'Daten aus strukturierter Extraktion (Seitenbelege im regulatorischen Datensatz).'
      : usedMaterialGraph
        ? 'Fluss aus den Materialprozenten im Digitalen Produktpass (Kernfelder).'
        : 'Flussbreiten folgen dem Mittelwert jedes Konzentrationsbereichs, normalisiert auf 100 %.';

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
      <div className="overflow-x-auto bg-gradient-to-b from-slate-50/60 via-white to-white px-2 pb-5 pt-5 sm:px-4 sm:pb-6 sm:pt-5">
        <div className="space-y-4">
          {hasMassBalance ? <MassBalanceStackedBar segments={massBalanceSegments} /> : null}
          {graph ? (
            <CompositionFlowchart nodes={graph.nodes} links={graph.links} height={460} variant="traceability" />
          ) : null}
          {hasIngredientOrigin ? <TraceabilityIngredientTable rows={ingredientRows} /> : null}
          <p className="px-1 text-center text-[11px] leading-relaxed text-slate-500 sm:text-xs">{footnote}</p>
        </div>
      </div>
    </section>
  );
}
