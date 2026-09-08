import { STAMMDATEN_FIELD_DEFS } from '@/app/domain/inbound/stammdatenDisplay';

const CARD_CLASS =
  'overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_28px_-6px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/[0.04]';

export function StammdatenFieldsCard() {
  return (
    <div className={`${CARD_CLASS} p-5`}>
      <h2 className="font-semibold text-[#0c1929]">Stammdaten (Excel / ERP)</h2>
      <p className="mt-1 text-xs text-slate-500">
        Pflicht-Stammdaten für den ESPR-Wirtschaftsbeteiligten — aus Excel/ERP oder PDF-Anreicherung.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead className="text-slate-500">
            <tr>
              <th className="pb-2 pr-4 font-semibold uppercase tracking-wide">Feld</th>
              <th className="pb-2 font-semibold uppercase tracking-wide">Excel-Spalten (Beispiele)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {STAMMDATEN_FIELD_DEFS.map((field) => (
              <tr key={field.key}>
                <td className="py-2 pr-4 font-medium text-slate-800">{field.label}</td>
                <td className="py-2 text-slate-600">{field.excelColumns}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
