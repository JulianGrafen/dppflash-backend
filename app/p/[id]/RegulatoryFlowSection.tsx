import { CompositionFlowchart } from '@/app/components/dpp/CompositionFlowchart';
import { compositionGraphSchema } from '@/app/domain/dpp/dppExtractionZodSchema';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/**
 * Renders audited Sankey when `regulatoryExtraction.compositionGraph` validates.
 */
export function RegulatoryFlowSection({ regulatoryExtraction }: { readonly regulatoryExtraction: unknown }) {
  if (!isRecord(regulatoryExtraction)) {
    return null;
  }

  const graphUnknown = regulatoryExtraction.compositionGraph;
  const parsed = compositionGraphSchema.safeParse(graphUnknown);
  if (!parsed.success) {
    return null;
  }

  return (
    <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 px-5 py-3 border-b border-gray-50 bg-indigo-50/40">
        Materialfluss & Lieferkette (regulatorisch)
      </h2>
      <div className="p-4 sm:p-5">
        <p className="text-xs text-gray-500 mb-4">
          Aus strukturierter Extraktion (OpenAI, seitenbasierte Belege). Rohstoffe links → Verarbeitung → Endprodukt.
        </p>
        <CompositionFlowchart nodes={parsed.data.nodes} links={parsed.data.links} height={440} />
      </div>
    </section>
  );
}
