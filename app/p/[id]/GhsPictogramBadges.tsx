import {
  inferGhsPictogramsFromHStatements,
  normalizeGhsPictogramCodeList,
} from '@/app/domain/rag/ghsPictogramCodes';

const GHS_LABELS: Record<string, string> = {
  GHS01: 'Explosiv',
  GHS02: 'Entzündbar',
  GHS03: 'Oxidierend',
  GHS04: 'Gas unter Druck',
  GHS05: 'Ätzend',
  GHS06: 'Akut toxisch',
  GHS07: 'Gesundheitsgefahr',
  GHS08: 'Schwere Gesundheitsgefahr',
  GHS09: 'Umwelt',
};

const GHS_DIAMOND: Record<string, string> = {
  GHS01: 'bg-red-600 text-white',
  GHS02: 'bg-orange-500 text-white',
  GHS03: 'bg-yellow-400 text-black',
  GHS04: 'bg-sky-500 text-white',
  GHS05: 'bg-amber-500 text-black',
  GHS06: 'bg-red-700 text-white',
  GHS07: 'bg-amber-400 text-black',
  GHS08: 'bg-red-600 text-white',
  GHS09: 'bg-emerald-600 text-white',
};

function GhsDiamond({ code }: { readonly code: string }) {
  const num = code.replace(/^GHS0?/, '');
  const palette = GHS_DIAMOND[code] ?? 'bg-slate-700 text-white';
  const label = GHS_LABELS[code] ?? code;
  return (
    <div className="flex flex-col items-center gap-1" title={`${code} — ${label}`}>
      <div
        className={`flex h-11 w-11 rotate-45 items-center justify-center rounded-sm border-2 border-slate-900/90 shadow-sm ${palette}`}
        aria-hidden
      >
        <span className="-rotate-45 text-sm font-bold leading-none">{num}</span>
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">{code}</span>
    </div>
  );
}

export function GhsPictogramBadges({
  codes,
  hStatementsForInference,
}: {
  readonly codes: readonly string[];
  readonly hStatementsForInference?: readonly string[];
}) {
  let resolved = normalizeGhsPictogramCodeList(codes);
  if (resolved.length === 0 && hStatementsForInference && hStatementsForInference.length > 0) {
    resolved = inferGhsPictogramsFromHStatements(hStatementsForInference);
  }
  if (resolved.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-end justify-end gap-4">
      {resolved.map((code) => (
        <GhsDiamond key={code} code={code} />
      ))}
    </div>
  );
}

export function formatGhsCodesDisplay(codes: readonly string[]): string {
  return normalizeGhsPictogramCodeList(codes).join(', ');
}
