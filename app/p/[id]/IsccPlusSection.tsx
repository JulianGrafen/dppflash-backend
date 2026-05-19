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
import { formatPassportCoreMaterialSummary } from '@/app/domain/dpp/materialCompositionToSankey';

type IsccPlusSectionProps = {
  readonly raw: Record<string, unknown>;
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

function unwrapValue(v: unknown): unknown {
  if (v && typeof v === 'object' && !Array.isArray(v) && 'value' in v) {
    return (v as Record<string, unknown>).value;
  }
  return v;
}

function unwrapString(v: unknown): string | undefined {
  const u = unwrapValue(v);
  return typeof u === 'string' && u.trim() ? u.trim() : undefined;
}

function deriveManufacturingSite(raw: Record<string, unknown>): string | undefined {
  const manufactured = unwrapString(raw.countryOfManufacturing);
  const origin = unwrapString(raw.countryOfOrigin) ?? asString(raw.herkunftsland);
  const m = asRecord(raw.manufacturer);
  const fromMfr = m ? [asString(m.name), asString(m.country), asString(m.address)].filter(Boolean).join(', ') : '';
  const parts = [fromMfr, manufactured, origin].flatMap((p) => (p && p.trim() ? [p.trim()] : []));
  const seen = new Set<string>();
  const uniq: string[] = [];
  for (const p of parts) {
    const key = p.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      uniq.push(p);
    }
  }
  return uniq.length > 0 ? uniq.join(' · ') : undefined;
}

function deriveRecycledSummary(raw: Record<string, unknown>): string | undefined {
  const rc = asRecord(raw.recycledContent);
  if (!rc) {
    return undefined;
  }
  const pairs: string[] = [];
  const defs = [
    ['cobaltPct', 'Kobalt'],
    ['lithiumPct', 'Lithium'],
    ['nickelPct', 'Nickel'],
    ['leadPct', 'Blei'],
  ] as const;
  for (const [key, label] of defs) {
    const n = asNumber(rc[key]);
    if (n !== undefined && n > 0) {
      pairs.push(`${label}: ${n.toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`);
    }
  }
  return pairs.length > 0 ? pairs.join(' · ') : undefined;
}

function deriveCarbonSummary(raw: Record<string, unknown>): string | undefined {
  const fromFlatTotal = asNumber(raw.co2FussabdruckKgGesamt);
  const fromFlatPer = asNumber(raw.co2FussabdruckKgProKwh);
  const cf = asRecord(raw.carbonFootprint);
  const cfTotal =
    cf
      ? asNumber(cf.totalKg) ?? asNumber(cf.valueKgCo2e)
      : undefined;
  const cfPer = cf ? asNumber(cf.perKwhKg) : undefined;

  const total = fromFlatTotal ?? cfTotal;
  const per = fromFlatPer ?? cfPer;

  const parts: string[] = [];
  if (total !== undefined) {
    parts.push(`Gesamt ${total.toLocaleString('de-DE', { maximumFractionDigits: 2 })} kg CO₂e`);
  }
  if (per !== undefined) {
    parts.push(`pro kWh ${per.toLocaleString('de-DE', { maximumFractionDigits: 3 })} kg CO₂e`);
  }

  return parts.length > 0 ? parts.join(' · ') : undefined;
}

function brandCorner(raw: Record<string, unknown>, block: Record<string, unknown> | undefined): string | undefined {
  const explicit =
    block ? asString(block.brandLine) ?? asString(block.brand) : undefined;
  if (explicit) {
    return explicit;
  }
  const m = asRecord(raw.manufacturer);
  return (m ? asString(m.name) : undefined) ?? asString(raw.hersteller);
}

type CustodyEntry = {
  readonly at: string;
  readonly summary: string;
  readonly referenceId?: string;
  readonly deltaKg?: number;
};

function parseCustody(rawList: unknown): CustodyEntry[] {
  if (!Array.isArray(rawList)) {
    return [];
  }
  const out: CustodyEntry[] = [];
  for (const item of rawList) {
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
 * Zertifikats-/Nachweiskarte wie Referenz-ISCC UI, befüllt mit:
 * - Optional `raw.isccPlus` (Overrides, Custody).
 * - Denselben **Kernfeldern** wie Material-Sankey / „Material‑Zusammensetzung“ (`formatPassportCoreMaterialSummary`, Gewicht,
 *   Standort, Zertifikatsstellen, CO₂-Kernfelder, Rezyklatanteile).
 */
export function IsccPlusSection({ raw }: IsccPlusSectionProps) {
  const block = asRecord(raw.isccPlus);

  const materialFromPassport = formatPassportCoreMaterialSummary(raw);
  const derivedSite = deriveManufacturingSite(raw);
  const derivedCert =
    unwrapString(raw.zertifizierungsstelle) ?? unwrapString(raw.certificationBody);
  const derivedWeight = asNumber(raw.gewichtKg) ?? asNumber(raw.weightKg);
  const derivedGhg = deriveCarbonSummary(raw);
  const derivedRecycle = deriveRecycledSummary(raw);
  const derivedChem = unwrapString(raw.chemischesSystem) ?? unwrapString(raw.chemistry);

  const scheme = block ? asString(block.scheme) ?? asString(block.certificationScheme) : undefined;

  const quantityKg =
    (block ? asNumber(block.quantityKg) ?? asNumber(block.massBalanceKg) : undefined) ?? derivedWeight;

  const manufacturingSite =
    (block ? asString(block.manufacturingSite) : undefined) ?? derivedSite;

  const certificate =
    (
      block
        ? asString(block.certificate) ?? asString(block.isccCertificate) ?? asString(block.certificateId)
        : undefined
    ) ?? derivedCert;

  const rawMaterialCategory =
    (block ? asString(block.rawMaterialCategory) ?? asString(block.rawMaterial) : undefined)
    ?? materialFromPassport;

  const feedstockType =
    (block ? asString(block.feedstockType) ?? asString(block.feedstock) : undefined)
    ?? derivedRecycle
    ?? derivedChem;

  const ghgEmissions =
    (block ? asString(block.ghgEmissions) : undefined) ?? derivedGhg;

  const brandText = brandCorner(raw, block);
  const custody = block ? parseCustody(block.chainOfCustody) : [];

  const isccContext =
    scheme !== undefined
    || !!(block && (
      asString(block.certificate)
      ?? asString(block.isccCertificate)
      ?? asString(block.certificateId)
    ));

  const tracedRows = [
    {
      key: 'site',
      label: 'Standort / Produktion',
      icon: Building2,
      value: manufacturingSite,
    },
    {
      key: 'cert',
      label: isccContext ? 'ISCC PLUS Zertifikat' : 'Zertifizierung / Zertifikat',
      icon: FileText,
      value: certificate,
    },
    {
      key: 'raw',
      label: 'Material-Zusammensetzung',
      icon: Drum,
      value: rawMaterialCategory,
    },
    {
      key: 'feed',
      label: 'Rezyklat / Produktbezug',
      icon: Package,
      value: feedstockType,
    },
    {
      key: 'ghg',
      label: 'THG / CO₂ (Kernfeld)',
      icon: Globe,
      value: ghgEmissions,
    },
  ].filter((row) => typeof row.value === 'string' && row.value.trim().length > 0);

  const hasHeroPills = scheme !== undefined || quantityKg !== undefined;
  const hasTraced = tracedRows.length > 0;
  const hasCustody = custody.length > 0;

  if (!hasHeroPills && !hasTraced && !hasCustody) {
    return null;
  }

  const tracedSectionTitle = scheme
    ? 'ISCC PLUS — nachvollziehbare Datenpunkte'
    : 'Material & Herkunft (DPP-Kernfelder)';

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_28px_-6px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/[0.04]">
      {(hasHeroPills || brandText) ? (
        <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            {hasHeroPills ? (
              <div className="flex flex-wrap gap-2">
                {quantityKg !== undefined ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-900 ring-1 ring-slate-200/80">
                    <Scale className="h-4 w-4 shrink-0 text-sky-600" aria-hidden />
                    {quantityKg.toLocaleString('de-DE', { maximumFractionDigits: 2 })} kg
                  </span>
                ) : null}
                {scheme ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-900 ring-1 ring-slate-200/80">
                    <Award className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                    {scheme}
                  </span>
                ) : null}
              </div>
            ) : null}
            {brandText ? (
              <p className="shrink-0 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:max-w-[42%]">
                {brandText}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {hasTraced ? (
        <div className="border-t border-sky-300/25 bg-gradient-to-b from-sky-50/80 to-white px-5 py-5 sm:px-6">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-900/70">
            {tracedSectionTitle}
          </h3>
          <ul className="mt-4 space-y-4">
            {tracedRows.map((row) => (
              <li key={row.key} className="flex gap-3 sm:gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[#0c1929]">
                  <row.icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{row.label}</p>
                  <p className="mt-1 inline-flex max-w-full rounded-full bg-white px-3 py-1.5 text-sm leading-snug text-slate-900 ring-1 ring-slate-200/90 shadow-sm">
                    <span className="break-words">{row.value}</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {hasCustody ? (
        <div className="border-t border-slate-100 bg-slate-50/80 px-5 py-5 sm:px-6">
          <h3 className="text-sm font-bold text-[#0c1929]">Lieferkettennachweis</h3>
          <ul className="mt-4 space-y-5">
            {custody.map((entry, i) => (
              <li key={`${entry.at}-${i}`} className="flex gap-3 text-sm text-slate-800">
                <Truck className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" aria-hidden />
                <div className="min-w-0">
                  {entry.at ? (
                    <p className="text-xs font-medium text-slate-500">{entry.at}</p>
                  ) : null}
                  <p className="mt-1 leading-relaxed">
                    <span>{entry.summary}</span>
                    {entry.referenceId ? (
                      <>
                        {' '}
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-slate-800 ring-1 ring-slate-200/90">
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
