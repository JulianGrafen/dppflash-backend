import {
  AVV_170106_DETAIL_CARD_TITLE,
  AVV_170106_DISPOSAL_SECTIONS,
} from '@/app/domain/dpp/waste/avv170106DisposalGuidance';

/**
 * **B2B-Entsorgungsdetailkarte** für AVV/EAK **170106** (gefährlicher Bauabfall).
 */
export function Avv170106DisposalDetailCard() {
  return (
    <div className="border-t border-slate-100 px-5 py-5">
      <div className="rounded-xl border border-slate-200/70 bg-slate-50/90 p-4 shadow-sm ring-1 ring-slate-900/[0.03] sm:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
          So entsorgen Sie das Produkt
        </p>
        <h3 className="mt-1 text-[13px] font-bold tracking-tight text-slate-900">
          {AVV_170106_DETAIL_CARD_TITLE}
        </h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {AVV_170106_DISPOSAL_SECTIONS.map((section) => (
            <div key={section.title} className="rounded-lg bg-white/70 px-3 py-3 ring-1 ring-slate-200/60">
              <p className="text-[12px] font-bold leading-snug text-slate-800">{section.title}</p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-slate-700">{section.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
