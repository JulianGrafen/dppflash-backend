import {
  Award,
  Building2,
  Drum,
  FileText,
  Globe,
  Package,
  Scale,
  Truck,
} from 'lucide-react';

type IsccPlusSectionProps = {
  readonly raw: Record<string, unknown>;
  readonly productId: string;
  readonly displayProductName: string;
};

function asRecord(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function asNumber(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function truncateProductId(id: string): string {
  if (id.length <= 14) {
    return id;
  }
  return `${id.slice(0, 5)}···${id.slice(-5)}`;
}

type CustodyEntry = {
  readonly at: string;
  readonly summary: string;
  readonly referenceId?: string;
  readonly deltaKg?: number;
};

function parseCustody(raw: unknown): CustodyEntry[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: CustodyEntry[] = [];
  for (const item of raw) {
    const o = asRecord(item);
    if (!o) {
      continue;
    }
    const atRaw = asString(o.at) ?? asString(o.timestamp) ?? asString(o.date);
    const summary = asString(o.summary) ?? asString(o.label) ?? asString(o.description) ?? '';
    if (!atRaw && !summary) {
      continue;
    }
    let at = atRaw ?? '';
    if (/^\d{4}-\d{2}-\d{2}/.test(at)) {
      try {
        at = new Date(at).toLocaleString('de-DE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch {
        /* keep string */
      }
    }
    const referenceId = asString(o.referenceId) ?? asString(o.ref) ?? asString(o.batchId);
    const deltaKg = asNumber(o.deltaKg) ?? asNumber(o.amountKg) ?? asNumber(o.delta);
    out.push({
      at,
      summary: summary || 'Eintrag',
      referenceId,
      deltaKg,
    });
  }
  return out;
}

/**
 * ISCC PLUS / Mass-Balance – Kartenlayout angelehnt an gängige DPP-Referenz-UI (Badges, Icons, Custody-Zeile).
 * Datenquelle: `raw.isccPlus` (optionaler Block im Produktpass).
 */
export function IsccPlusSection({ raw, productId, displayProductName }: IsccPlusSectionProps) {
  const block = asRecord(raw.isccPlus);
  if (!block) {
    return null;
  }

  const scheme = asString(block.scheme) ?? asString(block.certificationScheme);
  const quantityKg = asNumber(block.quantityKg) ?? asNumber(block.massBalanceKg);
  const manufacturingSite = asString(block.manufacturingSite);
  const certificate = asString(block.certificate) ?? asString(block.isccCertificate) ?? asString(block.certificateId);
  const rawMaterialCategory = asString(block.rawMaterialCategory) ?? asString(block.rawMaterial);
  const feedstockType = asString(block.feedstockType) ?? asString(block.feedstock);
  const ghgEmissions = asString(block.ghgEmissions);
  const brandLine = asString(block.brandLine) ?? asString(block.brand);
  const headline = asString(block.headline) ?? asString(block.title);

  const custody = parseCustody(block.chainOfCustody);

  const tracedRows = [
    { key: 'site', label: 'Standort / Produktion', icon: Building2, value: manufacturingSite },
    { key: 'cert', label: 'ISCC PLUS Zertifikat', icon: FileText, value: certificate },
    { key: 'raw', label: 'Rohstoffkategorie', icon: Drum, value: rawMaterialCategory },
    { key: 'feed', label: 'Feedstock-Typ', icon: Package, value: feedstockType },
    { key: 'ghg', label: 'THG-Emissionen (attributiert)', icon: Globe, value: ghgEmissions },
  ].filter((row) => row.value);

  const hasHeroPills = scheme !== undefined || quantityKg !== undefined;
  const hasTraced = tracedRows.length > 0;
  const hasCustody = custody.length > 0;

  if (!hasHeroPills && !hasTraced && !hasCustody) {
    return null;
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-md ring-1 ring-slate-900/[0.04]">
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-5 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              {headline ?? displayProductName}
            </h2>
            <p className="mt-1 font-mono text-xs text-slate-500">
              Produkt-ID: {truncateProductId(productId)}
            </p>
          </div>
          {brandLine ? (
            <p className="shrink-0 text-right text-xs font-semibold uppercase tracking-wide text-slate-400 sm:max-w-[40%] sm:pt-1">
              {brandLine}
            </p>
          ) : null}
        </div>

        {hasHeroPills ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {quantityKg !== undefined ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-800">
                <Scale className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                {quantityKg.toLocaleString('de-DE')} kg
              </span>
            ) : null}
            {scheme ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-800">
                <Award className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                {scheme}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {hasTraced ? (
        <div className="border-b border-slate-100 px-4 py-5 sm:px-6">
          <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
            ISCC PLUS — nachvollziehbare Datenpunkte
          </h3>
          <ul className="mt-4 space-y-4">
            {tracedRows.map((row) => (
              <li key={row.key} className="flex gap-3 sm:gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                  <row.icon className="h-5 w-5" strokeWidth={2} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-500">{row.label}</p>
                  <p className="mt-1 inline-flex max-w-full rounded-full bg-slate-100 px-3 py-1.5 text-sm leading-snug text-slate-900">
                    <span className="break-words">{row.value}</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {hasCustody ? (
        <div className="bg-slate-50/50 px-4 py-5 sm:px-6">
          <h3 className="text-sm font-bold text-slate-900">Lieferkettennachweis</h3>
          <ul className="mt-4 space-y-5">
            {custody.map((entry, i) => (
              <li key={`${entry.at}-${i}`} className="flex gap-3 text-sm text-slate-800">
                <Truck className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden />
                <div className="min-w-0">
                  {entry.at ? (
                    <p className="text-xs text-slate-500">{entry.at}</p>
                  ) : null}
                  <p className="mt-1 leading-relaxed">
                    <span>{entry.summary}</span>
                    {entry.referenceId ? (
                      <>
                        {' '}
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-slate-800 ring-1 ring-slate-200/80">
                          <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-sky-500" aria-hidden />
                          {entry.referenceId}
                        </span>
                      </>
                    ) : null}
                    {entry.deltaKg !== undefined ? (
                      <span className="ml-1 font-semibold tabular-nums text-emerald-700">
                        [+{entry.deltaKg.toLocaleString('de-DE')} kg]
                      </span>
                    ) : null}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
