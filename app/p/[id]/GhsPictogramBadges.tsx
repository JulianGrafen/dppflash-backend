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

/** Kanonische GHS-Piktogramme unter `public/ghs/` (Dateiname = Code + Endung). */
const GHS_ASSET_URLS: Readonly<Record<string, string>> = {
  GHS01: '/ghs/GHS01.svg',
  GHS02: '/ghs/GHS02.svg',
  GHS03: '/ghs/GHS03.svg',
  GHS04: '/ghs/GHS04.svg',
  GHS05: '/ghs/GHS05.png',
  GHS06: '/ghs/GHS06.svg',
  GHS07: '/ghs/GHS07.svg',
  GHS08: '/ghs/GHS08.png',
  GHS09: '/ghs/GHS09.svg',
};

function ghsAssetUrl(code: string): string | undefined {
  return GHS_ASSET_URLS[code];
}

function GhsPictogram({ code }: { readonly code: string }) {
  const label = GHS_LABELS[code] ?? code;
  const assetUrl = ghsAssetUrl(code);

  if (!assetUrl) {
    return (
      <div className="flex flex-col items-center gap-1" title={`${code} — ${label}`}>
        <span className="flex h-11 w-11 items-center justify-center rounded border border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-600">
          {code.replace(/^GHS0?/, 'GHS0')}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">{code}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1" title={`${code} — ${label}`}>
      <img
        src={assetUrl}
        alt={`${code} — ${label}`}
        width={44}
        height={44}
        className="h-11 w-11 object-contain"
        loading="lazy"
      />
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
    <div className="flex flex-wrap items-end justify-start gap-3 sm:justify-end">
      {resolved.map((code) => (
        <GhsPictogram key={code} code={code} />
      ))}
    </div>
  );
}

export function formatGhsCodesDisplay(codes: readonly string[]): string {
  return normalizeGhsPictogramCodeList(codes).join(', ');
}
