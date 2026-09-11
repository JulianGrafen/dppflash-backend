import { buildStammdatenRows, countFilledStammdaten } from '@/app/domain/inbound/stammdatenDisplay';

type DraftStammdatenSectionProps = {
  payload: Record<string, unknown>;
};

export function DraftStammdatenSection({ payload }: DraftStammdatenSectionProps) {
  const rows = buildStammdatenRows(payload);
  const { filled, total } = countFilledStammdaten(payload);

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#0c1929]">Stammdaten (Tenant)</h3>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">
          {filled} / {total} befüllt
        </span>
      </div>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li
            key={row.key}
            className="rounded-xl border border-slate-200/80 bg-white px-3 py-3 shadow-sm"
          >
            <div className="flex items-start gap-2">
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                  row.filled ? 'bg-sky-500' : 'bg-slate-300'
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800">{row.label}</p>
                <p className="mt-1 text-sm text-slate-700">
                  {row.value ?? <span className="italic text-slate-400">— leer —</span>}
                </p>
                <p className="mt-1 font-mono text-[10px] text-slate-400">{row.key}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${
                  row.filled
                    ? 'bg-sky-50 text-sky-800 ring-sky-200'
                    : 'bg-slate-50 text-slate-500 ring-slate-200'
                }`}
              >
                {row.filled ? 'Gesetzt' : 'Offen'}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
