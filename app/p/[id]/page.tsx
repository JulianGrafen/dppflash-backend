import { getProductById } from '../../lib/mock-data';
import { notFound } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  Battery,
  Building2,
  ClipboardList,
  Cpu,
  FileStack,
  Gauge,
  Globe2,
  Menu,
  Recycle,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import type { EsprProductData } from '../../types/espr';
import {
  coerceMaterialCompositionArray,
  tryChemicalCompositionToSankey,
} from '@/app/domain/dpp/materialCompositionToSankey';
import { RagProvenanceSection } from './RagProvenanceSection';
import { TraceabilitySection } from './TraceabilitySection';
import { ChemicalCompositionFlowSection } from './ChemicalCompositionFlowSection';
import { IsccPlusSection } from './IsccPlusSection';
import { isRagProvenanceEnvelope } from '@/app/domain/rag/mergeRagAuditIntoPassport';

// ─── Page contract ────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ d?: string }>;
}

// ─── Presentational helpers ───────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_28px_-6px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/[0.04]">
      <div className="flex items-center gap-3 bg-[#0c1929] px-5 py-4 text-white">
        {Icon ? (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.12] backdrop-blur-sm">
            <Icon className="h-5 w-5 text-sky-300" strokeWidth={1.75} aria-hidden />
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold leading-snug tracking-tight">{title}</h2>
          {subtitle ? (
            <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      <dl className="divide-y divide-slate-100">{children}</dl>
    </section>
  );
}

function Field({
  label,
  value,
  sourceBadge,
  multiline,
}: {
  label: string;
  value?: string | number;
  /** Short provenance label, e.g. RAG from indexed PDF */
  sourceBadge?: string;
  /** SDS-style mehrzeiliger Herstellernachweis (Abschnitt 1) */
  multiline?: boolean;
}) {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value);
  if (multiline) {
    return (
      <div className="flex flex-col gap-1.5 px-5 py-3.5 sm:max-w-none">
        <dt className="text-[13px] font-medium leading-snug text-slate-500">{label}</dt>
        <dd className="w-full max-w-none whitespace-pre-line text-[13px] font-semibold leading-relaxed text-slate-900">
          <span>{text}</span>
          {sourceBadge ? (
            <span
              className="mt-2 inline-flex rounded-md bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-900"
              title="Aus dem hochgeladenen Dokument (RAG-Index) übernommen"
            >
              {sourceBadge}
            </span>
          ) : null}
        </dd>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-0.5 px-5 py-3.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <dt className="text-[13px] font-medium leading-snug text-slate-500 sm:w-[40%] sm:shrink-0">{label}</dt>
      <dd className="text-[13px] font-semibold leading-snug text-slate-900 sm:max-w-[58%] sm:text-right">
        <span>{text}</span>
        {sourceBadge ? (
          <span
            className="ml-2 inline-flex align-middle rounded-md bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-900"
            title="Aus dem hochgeladenen Dokument (RAG-Index) übernommen"
          >
            {sourceBadge}
          </span>
        ) : null}
      </dd>
    </div>
  );
}

function ReviewField({
  label,
  value,
  highlighted,
  sourceBadge,
}: {
  label: string;
  value?: string | number;
  highlighted: boolean;
  sourceBadge?: string;
}) {
  if (!highlighted) {
    return <Field label={label} value={value} sourceBadge={sourceBadge} />;
  }

  if (value === undefined || value === null || value === '') return null;

  return (
    <div className="flex flex-col gap-0.5 bg-amber-50/80 px-5 py-3.5 ring-1 ring-inset ring-amber-200/60 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <dt className="text-[13px] font-medium leading-snug text-amber-800 sm:w-[40%] sm:shrink-0">{label}</dt>
      <dd className="text-[13px] font-semibold leading-snug text-amber-950 sm:max-w-[58%] sm:text-right">
        <span>{String(value)}</span>
        {sourceBadge ? (
          <span
            className="ml-2 inline-flex align-middle rounded-md bg-white/80 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-900 ring-1 ring-amber-200/80"
            title="Aus dem hochgeladenen Dokument (RAG-Index) übernommen"
          >
            {sourceBadge}
          </span>
        ) : null}
      </dd>
    </div>
  );
}

function Pct({ label, value }: { label: string; value?: number }) {
  if (value === undefined) return null;
  return <Field label={label} value={`${value} %`} />;
}

function formatPercentage(value: unknown): string | undefined {
  if (typeof value !== 'number') {
    return undefined;
  }

  return `${value} %`;
}

type KeyValueEntry = { readonly title: string; readonly details?: string };

function compactEntries(entries: Array<KeyValueEntry | null>): KeyValueEntry[] {
  return entries.flatMap((entry) => entry ? [entry] : []);
}

function renderKeyValueList(
  label: string,
  entries: readonly KeyValueEntry[],
) {
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-col gap-0.5 px-5 py-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <dt className="text-[13px] font-medium leading-snug text-slate-500 sm:w-[40%] sm:shrink-0">{label}</dt>
      <dd className="space-y-2 text-[13px] font-semibold text-slate-900 sm:max-w-[58%] sm:text-right">
        {entries.map((entry) => (
          <div key={`${label}-${entry.title}-${entry.details ?? ''}`}>
            <div>{entry.title}</div>
            {entry.details ? (
              <div className="mt-0.5 whitespace-pre-line text-[12px] font-normal leading-snug text-slate-500">
                {entry.details}
              </div>
            ) : null}
          </div>
        ))}
      </dd>
    </div>
  );
}

function pickMaterialCompositionPercent(entry: Record<string, unknown>): number | undefined {
  for (const k of ['percentage', 'sharePercent', 'anteil', 'percent', 'massPercent', 'share', 'concentrationPercent', 'prozentAnteil'] as const) {
    if (!(k in entry)) continue;
    const v = entry[k];
    if (typeof v === 'number' && Number.isFinite(v)) {
      return v;
    }
    if (typeof v === 'string' && v.trim()) {
      const t = v.trim().replace(/\s+/g, '').replace(',', '.');
      const n = Number(t.endsWith('%') ? t.slice(0, -1) : t);
      if (Number.isFinite(n)) {
        return n;
      }
    }
  }
  return undefined;
}

function materialNameFromCompositionEntry(entry: Record<string, unknown>): string | undefined {
  for (const k of ['material', 'name', 'bezeichnung', 'materialName', 'stoffname', 'component', 'substance', 'title'] as const) {
    const v = entry[k];
    if (typeof v === 'string' && v.trim()) {
      return v.trim();
    }
  }
  return undefined;
}

function unwrapProvenanceInner(value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value) && 'value' in value) {
    return (value as Record<string, unknown>).value;
  }
  return value;
}

type SdsCompositionDisplayRow = {
  readonly stoffname: string;
  readonly casDisplay: string;
  readonly konzentration: string;
  readonly einstufung: string;
};

/** SDS-/REACH-Zeilendarstellung (stoffname, casNummer, prozentAnteil, einstufung). */
function parseSdsCompositionDisplayRow(entry: Record<string, unknown>): SdsCompositionDisplayRow | null {
  const stoff =
    (typeof entry.stoffname === 'string' ? entry.stoffname.trim() : '')
    || (typeof entry.substance === 'string' ? entry.substance.trim() : '')
    || (typeof entry.name === 'string' ? entry.name.trim() : '');
  if (!stoff) {
    return null;
  }

  const casRaw = entry.casNummer ?? entry.casNumber;
  const casDisplay =
    casRaw !== null && casRaw !== undefined && String(casRaw).trim().length > 0
      ? String(casRaw).trim()
      : '-';

  let konzentration = '-';
  if (typeof entry.prozentAnteil === 'string' && entry.prozentAnteil.trim()) {
    konzentration = entry.prozentAnteil.trim();
  } else if (typeof entry.concentrationPercent === 'number' && Number.isFinite(entry.concentrationPercent)) {
    konzentration = `${entry.concentrationPercent} %`;
  } else if (typeof entry.concentrationPercent === 'string' && entry.concentrationPercent.trim()) {
    konzentration = entry.concentrationPercent.trim();
  }

  let einstufung = '-';
  if (typeof entry.einstufung === 'string' && entry.einstufung.trim()) {
    einstufung = entry.einstufung.trim();
  } else if (typeof entry.function === 'string' && entry.function.trim()) {
    einstufung = entry.function.trim();
  }

  return { stoffname: stoff, casDisplay, konzentration, einstufung };
}

function extractSdsCompositionRows(arr: unknown): SdsCompositionDisplayRow[] {
  if (!Array.isArray(arr)) {
    return [];
  }
  const rows: SdsCompositionDisplayRow[] = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      continue;
    }
    const row = parseSdsCompositionDisplayRow(item as Record<string, unknown>);
    if (row) {
      rows.push(row);
    }
  }
  return rows;
}

/** Heuristik: SDS-Reihen vs. klassisches ESPR-Materialarray ({ material, percentage }). */
function looksLikeSdsCompositionArray(arr: unknown[]): boolean {
  if (arr.length === 0) {
    return false;
  }
  let score = 0;
  for (const item of arr) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      continue;
    }
    const o = item as Record<string, unknown>;
    if (typeof o.stoffname === 'string' && o.stoffname.trim()) {
      score++;
    } else if (o.casNummer !== null && o.casNummer !== undefined && String(o.casNummer).trim()) {
      score++;
    } else if (typeof o.einstufung === 'string' && o.einstufung.trim()) {
      score++;
    }
  }
  return score >= Math.max(1, Math.ceil(arr.length * 0.5));
}

/** Entpackt Provenance und optional JSON-String `[...]` aus Speicher/API. */
function unwrapMaterialZusammensetzungArrayCandidate(value: unknown): unknown[] | undefined {
  const inner = unwrapProvenanceInner(value);
  if (Array.isArray(inner)) {
    return inner;
  }
  if (typeof inner === 'string') {
    const t = inner.trim();
    if (t.startsWith('[')) {
      try {
        const parsed: unknown = JSON.parse(t);
        return Array.isArray(parsed) ? parsed : undefined;
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

function renderSdsCompositionTable(label: string, rows: readonly SdsCompositionDisplayRow[]) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <dt className="text-[13px] font-medium leading-snug text-slate-500 sm:w-[40%] sm:shrink-0">{label}</dt>
      <dd className="min-w-0 flex-1 text-[13px] text-slate-900 sm:max-w-[58%]">
        <div className="overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-sm">
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
              {rows.map((r, i) => (
                <tr key={`${label}-${r.stoffname}-${r.casDisplay}-${i}`} className="bg-white">
                  <td className="px-3 py-2 font-semibold text-slate-900">{r.stoffname}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-600 tabular-nums">{r.casDisplay}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-600">{r.konzentration}</td>
                  <td className="px-3 py-2 text-slate-700">{r.einstufung}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </dd>
    </div>
  );
}

/** ESPR Kernfeld materialComposition + legacy Textfeld materialZusammensetzung (z. B. Textilien). */
function renderMaterialZusammensetzungKernfelder(
  materialComposition: unknown,
  materialZusammensetzung: unknown,
) {
  const mzArray = unwrapMaterialZusammensetzungArrayCandidate(materialZusammensetzung);
  const sdsFromMz = mzArray ? extractSdsCompositionRows(mzArray) : [];

  const compositionItems = coerceMaterialCompositionArray(materialComposition);
  const sdsFromMc =
    sdsFromMz.length === 0 && looksLikeSdsCompositionArray(compositionItems)
      ? extractSdsCompositionRows(compositionItems)
      : [];

  const sdsRows = sdsFromMz.length > 0 ? sdsFromMz : sdsFromMc;
  const tableEl = renderSdsCompositionTable('Material-Zusammensetzung', sdsRows);

  const entries: KeyValueEntry[] = [];
  const skipGenericCompositionList = sdsFromMc.length > 0;

  if (!skipGenericCompositionList) {
    for (const item of compositionItems) {
      if (!item || typeof item !== 'object') {
        continue;
      }
      const row = item as Record<string, unknown>;
      const title = materialNameFromCompositionEntry(row);
      if (!title) {
        continue;
      }
      const pct = pickMaterialCompositionPercent(row);
      entries.push({
        title,
        details: pct !== undefined ? formatPercentage(pct) : undefined,
      });
    }
  }

  const mzInner = unwrapProvenanceInner(materialZusammensetzung);
  const legacy =
    typeof materialZusammensetzung === 'string' && materialZusammensetzung.trim().length > 0
      ? materialZusammensetzung.trim()
      : typeof mzInner === 'string' && mzInner.trim().length > 0 && !mzInner.trim().startsWith('[')
        ? mzInner.trim()
        : undefined;

  const list = entries.length > 0 ? renderKeyValueList('Material-Zusammensetzung', entries) : null;

  if (tableEl || list) {
    return (
      <>
        {tableEl}
        {list}
        {legacy && (tableEl !== null || (list !== null && entries.length > 0)) ? (
          <Field label="Material-Zusammensetzung (Text)" value={legacy} />
        ) : null}
      </>
    );
  }

  if (legacy) {
    return <Field label="Material-Zusammensetzung" value={legacy} />;
  }

  return null;
}

function renderRecycledContent(value: unknown) {
  if (!Array.isArray(value)) return null;

  const entries = value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];

    const material = 'material' in entry && typeof entry.material === 'string'
      ? entry.material
      : undefined;
    const percentage = 'percentage' in entry ? formatPercentage(entry.percentage) : undefined;

    if (!material) return [];

    return [{
      title: material,
      details: percentage,
    }];
  });

  return renderKeyValueList('Rezyklatanteil', entries);
}

function renderCarbonFootprint(value: unknown) {
  if (!value || typeof value !== 'object') return null;

  const entries = compactEntries([
    'valueKgCo2e' in value && typeof value.valueKgCo2e === 'number'
      ? { title: `${value.valueKgCo2e} kg CO₂e` }
      : null,
    'lifecycleStage' in value && typeof value.lifecycleStage === 'string' && value.lifecycleStage
      ? { title: 'Lebenszyklusphase', details: value.lifecycleStage }
      : null,
    'calculationMethod' in value && typeof value.calculationMethod === 'string' && value.calculationMethod
      ? { title: 'Berechnungsmethode', details: value.calculationMethod }
      : null,
  ]);

  return renderKeyValueList('CO₂-Fußabdruck', entries);
}

type SubstanceOfConcernDisplayRow = {
  readonly name: string;
  readonly casDisplay: string;
  readonly hDisplay: string;
  readonly pDisplay: string;
  readonly ghsDisplay: string;
  readonly concentration: string;
  readonly classification: string;
};

/** Sammelt H-/P-/GHS-Kennungen aus deutsch/englisch benannten JSON-Feldern. */
function collectDistinctHazardCodes(...vals: unknown[]): string[] {
  const out: string[] = [];
  for (const v of vals) {
    if (v === undefined || v === null) {
      continue;
    }
    if (Array.isArray(v)) {
      for (const x of v) {
        if (typeof x === 'string' && x.trim()) {
          out.push(x.trim());
        }
      }
    } else if (typeof v === 'string' && v.trim()) {
      const t = v.trim();
      out.push(
        ...t.split(/[,;]|(?=\s+H\d)|(?=\s+P\d)|(?=\s+GHS\d{2}\b)/i).map((s) => s.trim()).filter(Boolean),
      );
    }
  }
  return [...new Set(out)];
}

function formatCodeCellDisplay(codes: readonly string[]): string {
  return codes.length > 0 ? codes.join(', ') : '—';
}

/** Entpackt Provenance + `[...]`-JSON-Strings — gleiche Semantik wie bisher zwei getrennte Renderpfade. */
function parseHazardFieldToStructuredArray(candidate: unknown): unknown[] | null {
  let inner: unknown = unwrapProvenanceInner(candidate);
  if (typeof inner === 'string') {
    const t = inner.trim();
    if (t.startsWith('[')) {
      try {
        inner = JSON.parse(t) as unknown;
      } catch {
        return null;
      }
    }
  }
  if (!Array.isArray(inner) || inner.length === 0) {
    return null;
  }
  return inner;
}

function parseSubstancesOfConcernRows(inner: readonly unknown[]): SubstanceOfConcernDisplayRow[] {
  const rows: SubstanceOfConcernDisplayRow[] = [];
  for (const entry of inner) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }
    const o = entry as Record<string, unknown>;
    const name =
      (typeof o.name === 'string' ? o.name.trim() : '')
      || (typeof o.stoffname === 'string' ? o.stoffname.trim() : '');
    if (!name) {
      continue;
    }

    const casRaw = o.casNumber ?? o.casNummer;
    const casDisplay =
      casRaw !== null && casRaw !== undefined && String(casRaw).trim().length > 0
        ? String(casRaw).trim()
        : '—';

    let concentration = '—';
    if (typeof o.anteilOderGrenzwert === 'string' && o.anteilOderGrenzwert.trim()) {
      concentration = o.anteilOderGrenzwert.trim();
    } else if (typeof o.concentrationPercent === 'number' && Number.isFinite(o.concentrationPercent)) {
      concentration = formatPercentage(o.concentrationPercent) ?? '—';
    } else if (typeof o.concentrationPercent === 'string' && o.concentrationPercent.trim()) {
      concentration = o.concentrationPercent.trim();
    }

    const hCodes = collectDistinctHazardCodes(o.hStatements, o.hazardStatements, o.hSaetze);
    const pCodes = collectDistinctHazardCodes(o.pStatements, o.precautionaryStatements, o.pSaetze);
    const gCodes = collectDistinctHazardCodes(o.ghsPictograms, o.ghsSymbols, o.gefahrenpiktogramme);

    const classification =
      (typeof o.hazardClass === 'string' && o.hazardClass.trim() ? o.hazardClass.trim() : '')
      || (typeof o.hinweis === 'string' && o.hinweis.trim() ? o.hinweis.trim() : '')
      || '—';

    rows.push({
      name,
      casDisplay,
      hDisplay: formatCodeCellDisplay(hCodes),
      pDisplay: formatCodeCellDisplay(pCodes),
      ghsDisplay: formatCodeCellDisplay(gCodes),
      concentration,
      classification,
    });
  }
  return rows;
}

function renderHazardousIngredientsTable(rows: readonly SubstanceOfConcernDisplayRow[]) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <dt className="text-[13px] font-semibold leading-snug text-slate-800 sm:w-[38%] sm:shrink-0">
        Gefährliche Inhaltsstoffe{' '}
        <span className="block pt-0.5 text-[11px] font-normal uppercase tracking-wide text-slate-400">
          Substances of concern · CAS · GHS · H/P
        </span>
      </dt>
      <dd className="min-w-0 flex-1 text-[13px] text-slate-900 sm:max-w-[62%]">
        <div className="overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-sm">
          <table className="min-w-full table-fixed text-left text-[13px]">
            <thead className="bg-amber-50/90 text-[11px] font-bold uppercase tracking-wider text-slate-700">
              <tr>
                <th className="px-3 py-2.5 w-[18%]">Stoff</th>
                <th className="px-3 py-2.5 whitespace-nowrap w-[11%]">CAS</th>
                <th className="px-3 py-2.5 w-[14%]">H</th>
                <th className="px-3 py-2.5 w-[14%]">P</th>
                <th className="px-3 py-2.5 w-[13%]">GHS</th>
                <th className="px-3 py-2.5 w-[14%] whitespace-nowrap">Anteil&nbsp;/ Grenze</th>
                <th className="px-3 py-2.5 w-[16%]">Hinweis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={`${r.name}-${r.casDisplay}-${i}`} className="bg-white align-top">
                  <td className="px-3 py-2 font-semibold text-slate-900 break-words">{r.name}</td>
                  <td className="px-3 py-2 whitespace-nowrap font-mono text-[12px] text-slate-800">{r.casDisplay}</td>
                  <td className="px-3 py-2 text-slate-700 break-words text-[12px] leading-snug">{r.hDisplay}</td>
                  <td className="px-3 py-2 text-slate-700 break-words text-[12px] leading-snug">{r.pDisplay}</td>
                  <td className="px-3 py-2 font-mono text-[12px] text-slate-800 break-words">{r.ghsDisplay}</td>
                  <td className="px-3 py-2 text-slate-700 break-words text-[12px]">{r.concentration}</td>
                  <td className="px-3 py-2 text-slate-600 break-words text-[12px] leading-snug">{r.classification}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </dd>
    </div>
  );
}

/**
 * Kombiniert `substancesOfConcern` und Kernfeld `gefahrenstoffe` (Chemikalien-Slot) ohne doppeltes Rendering.
 */
function renderUnifiedHazardousIngredients(substancesOfConcernRaw: unknown, gefahrenstoffeRaw: unknown) {
  const primary = parseHazardFieldToStructuredArray(substancesOfConcernRaw);
  const secondary = parseHazardFieldToStructuredArray(gefahrenstoffeRaw);
  const inner = primary ?? secondary;

  if (!inner?.length) {
    return null;
  }

  if (inner.every((x) => typeof x === 'string')) {
    return renderKeyValueList(
      'Gefährliche Inhaltsstoffe · Substances of concern',
      inner.map((s) => ({ title: typeof s === 'string' ? s : String(s) })),
    );
  }

  const rows = parseSubstancesOfConcernRows(inner);
  return renderHazardousIngredientsTable(rows);
}

function renderSupplierAndProcessInformation(value: unknown) {
  if (!Array.isArray(value)) return null;

  const entries = value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];

    const level = 'level' in entry && typeof entry.level === 'string' ? entry.level : undefined;
    const supplierName = 'supplierName' in entry && typeof entry.supplierName === 'string'
      ? entry.supplierName
      : undefined;
    const supplierCountry = 'supplierCountry' in entry && typeof entry.supplierCountry === 'string'
      ? entry.supplierCountry
      : undefined;
    const processName = 'processName' in entry && typeof entry.processName === 'string'
      ? entry.processName
      : undefined;
    const processDescription = 'processDescription' in entry && typeof entry.processDescription === 'string'
      ? entry.processDescription
      : undefined;

    if (!level && !supplierName && !processName) return [];

    const title = [level, supplierName, processName].filter(Boolean).join(' · ');
    const details = [supplierCountry, processDescription].filter(Boolean).join(' · ');

    return [{
      title,
      details: details || undefined,
    }];
  });

  return renderKeyValueList('Lieferanten- & Prozessinfos', entries);
}

function renderCareRepairDurability(value: unknown) {
  if (!value || typeof value !== 'object') return null;

  const entries = compactEntries([
    'careInstructions' in value && typeof value.careInstructions === 'string' && value.careInstructions
      ? { title: 'Pflegehinweise', details: value.careInstructions }
      : null,
    'repairInstructions' in value && typeof value.repairInstructions === 'string' && value.repairInstructions
      ? { title: 'Reparaturhinweise', details: value.repairInstructions }
      : null,
    'durabilityGuidance' in value && typeof value.durabilityGuidance === 'string' && value.durabilityGuidance
      ? { title: 'Haltbarkeit', details: value.durabilityGuidance }
      : null,
  ]);

  return renderKeyValueList('Pflege, Reparatur & Haltbarkeit', entries);
}

function renderChemicalComposition(value: unknown) {
  let inner: unknown = unwrapProvenanceInner(value);
  if (typeof inner === 'string') {
    const t = inner.trim();
    if (t.startsWith('[')) {
      try {
        inner = JSON.parse(t);
      } catch {
        /* keep string — kein Tabellenlayout */
      }
    }
  }
  if (!Array.isArray(inner)) {
    return null;
  }

  const tableRows = extractSdsCompositionRows(inner);
  if (tableRows.length > 0) {
    return renderSdsCompositionTable('Chemische Zusammensetzung', tableRows);
  }

  const entries = inner.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];

    const substance =
      ('substance' in entry && typeof entry.substance === 'string' ? entry.substance.trim() : '')
      || ('stoffname' in entry && typeof entry.stoffname === 'string' ? entry.stoffname.trim() : '')
      || undefined;

    const casNumber =
      ('casNumber' in entry && typeof entry.casNumber === 'string' ? entry.casNumber : undefined)
      ?? ('casNummer' in entry && entry.casNummer !== null && typeof entry.casNummer === 'string'
        ? entry.casNummer
        : undefined);

    const pctFromStructured =
      'prozentAnteil' in entry && typeof entry.prozentAnteil === 'string' && entry.prozentAnteil.trim()
        ? entry.prozentAnteil.trim()
        : undefined;
    const concentration = 'concentrationPercent' in entry ? formatPercentage(entry.concentrationPercent) : undefined;

    const substanceFunction =
      ('function' in entry && typeof entry.function === 'string' && entry.function.trim()
        ? entry.function.trim()
        : undefined)
      ?? ('einstufung' in entry && entry.einstufung !== null && typeof entry.einstufung === 'string'
        ? entry.einstufung.trim()
        : undefined);

    if (!substance) return [];

    const details = [casNumber, pctFromStructured ?? concentration, substanceFunction].filter(Boolean).join(' · ');

    return [{
      title: substance,
      details: details || undefined,
    }];
  });

  return renderKeyValueList('Chemische Zusammensetzung', entries);
}

function renderEnvironmentalImpact(value: unknown) {
  if (!value || typeof value !== 'object') return null;

  const entries = compactEntries([
    'waterFootprintLiters' in value && typeof value.waterFootprintLiters === 'number'
      ? { title: 'Wasserfußabdruck', details: `${value.waterFootprintLiters} l` }
      : null,
    'impactNotes' in value && typeof value.impactNotes === 'string' && value.impactNotes
      ? { title: 'Umwelthinweise', details: value.impactNotes }
      : null,
  ]);

  return renderKeyValueList('Umweltwirkung', entries);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function pickFirstStringFromRecord(
  rec: Record<string, unknown> | undefined,
  keys: readonly string[],
): string | undefined {
  if (!rec) {
    return undefined;
  }
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === 'string' && v.trim()) {
      return v.trim();
    }
  }
  return undefined;
}

function provenanceContextSnippet(envelopeValue: unknown): string | undefined {
  if (!isRagProvenanceEnvelope(envelopeValue)) {
    return undefined;
  }
  const snippet = String((envelopeValue as Record<string, unknown>).contextSnippet ?? '').trim();
  return snippet.length > 0 ? snippet : undefined;
}

/** Wörtlicher PDF-/Index-Belegauszug zu Hersteller (Eager-/RAG-Provenance `contextSnippet`). */
function pickManufacturerDocumentChunk(raw: Record<string, unknown>): string | undefined {
  const fromPassportEnvelope =
    provenanceContextSnippet(raw.hersteller)
    ?? provenanceContextSnippet(raw.manufacturer)
    ?? provenanceContextSnippet(raw.Hersteller);
  if (fromPassportEnvelope) {
    return fromPassportEnvelope;
  }

  const enrichment = raw.ragEnrichment;
  const enrichmentRecord =
    typeof enrichment === 'object' && enrichment !== null && !Array.isArray(enrichment)
      ? (enrichment as Record<string, unknown>)
      : undefined;
  if (
    !enrichmentRecord
    || !('auditTrail' in enrichmentRecord)
    || enrichmentRecord.success !== true
  ) {
    return undefined;
  }
  const auditTrail = enrichmentRecord.auditTrail;
  if (!auditTrail || typeof auditTrail !== 'object' || Array.isArray(auditTrail)) {
    return undefined;
  }
  const trailRec = auditTrail as Record<string, unknown>;
  const fields =
    trailRec.fields && typeof trailRec.fields === 'object' && trailRec.fields !== null
      ? (trailRec.fields as Record<string, unknown>)
      : undefined;

  const keysToTry = [
    'hersteller',
    'manufacturer',
    'herstellerName',
    'herstellername',
    'Manufacturer',
  ] as const;
  for (const key of keysToTry) {
    const audited = fields?.[key];
    if (!audited || typeof audited !== 'object' || audited === null) {
      continue;
    }
    const src = 'source' in audited ? (audited as { source?: unknown }).source : undefined;
    if (!src || typeof src !== 'object' || Array.isArray(src)) {
      continue;
    }
    const snippetRaw = (src as Record<string, unknown>).contextSnippet;
    const sn = typeof snippetRaw === 'string' ? snippetRaw.trim() : '';
    if (sn.length > 0) {
      return sn;
    }
  }
  return undefined;
}

/** Priorisiert dokumentnahen Chunk, sonst strukturierten Freitext. */
function resolveManufacturerPublication(raw: Record<string, unknown>, p: EsprProductData): {
  readonly displayText: string;
  readonly showedDocumentChunk: boolean;
} {
  const chunk = pickManufacturerDocumentChunk(raw)?.trim();
  const synthesized =
    formatManufacturerRichText(raw, p.manufacturer).trim()
    || p.manufacturer.name.trim()
    || p.hersteller.trim();

  if (chunk?.length) {
    return {
      displayText: chunk,
      showedDocumentChunk: true,
    };
  }
  if (synthesized.length > 0) {
    return { displayText: synthesized, showedDocumentChunk: false };
  }
  return { displayText: '', showedDocumentChunk: false };
}

function formatTelDisplay(phone: string | undefined): string | undefined {
  if (!phone?.trim()) {
    return undefined;
  }
  const t = phone.trim();
  if (/^(?:tel\.?|fax):/i.test(t)) {
    return t;
  }
  return `Tel.: ${t}`;
}

/** Anzeigentext wie SDB Abschnitt 1: Firma, Anschrift, Tel., E-Mail … */
function formatManufacturerRichText(
  raw: Record<string, unknown>,
  manufacturerView: EsprProductData['manufacturer'],
): string {
  const rec = asRecord(raw.manufacturer);

  const preformatted = pickFirstStringFromRecord(rec, [
    'contactBlock',
    'contactDetails',
    'fullContact',
    'herstellerBlock',
    'herstellerAngaben',
    'kontakt',
  ]);
  if (preformatted) {
    return preformatted;
  }

  const phoneFromRec = pickFirstStringFromRecord(rec, [
    'phone',
    'telephone',
    'tel',
    'Telefon',
    'telefon',
    'phoneNumber',
    'fax',
    'Fax',
    'Telefax',
  ]);

  const emailFromRec = pickFirstStringFromRecord(rec, [
    'email',
    'eMail',
    'mail',
    'e-mail',
    'E-Mail',
    'contactEmail',
    'kontaktEmail',
    'serviceEmail',
  ]);

  const websiteFromRec = pickFirstStringFromRecord(rec, [
    'website',
    'url',
    'web',
    'homepage',
    'Homepage',
    'internet',
  ]);

  const lines: string[] = [];

  const name =
    manufacturerView.name?.trim()
    || pickFirstStringFromRecord(rec, ['name', 'company', 'firma'])
    || '';
  if (name) {
    lines.push(name);
  }
  if (manufacturerView.address?.trim()) {
    lines.push(manufacturerView.address.trim());
  }
  if (manufacturerView.country?.trim()) {
    lines.push(manufacturerView.country.trim());
  }

  const tel = formatTelDisplay(manufacturerView.phone ?? phoneFromRec);
  if (tel) {
    lines.push(tel);
  }

  const email = manufacturerView.email?.trim() ?? emailFromRec;
  if (email) {
    lines.push(email);
  }

  const website = manufacturerView.website?.trim() ?? websiteFromRec;
  if (website) {
    lines.push(website);
  }

  if (manufacturerView.eoriNumber?.trim()) {
    lines.push(`EORI: ${manufacturerView.eoriNumber.trim()}`);
  }

  const structured = lines.join('\n').trim();
  const flatHersteller = typeof raw.hersteller === 'string' ? raw.hersteller.trim() : '';

  if (flatHersteller) {
    const structPackedLen = structured.replace(/\s/g, '').length;
    const flatSignalsContact = /[@+]|\btel\b|https?:\/\//i.test(flatHersteller);
    const structSignalsContact =
      /@|\btel\b|\+?\d[\d\s().-]{10,}|https?:\/\//i.test(structured.replace(/Tel\.:\s*/gi, ''));

    if (
      flatSignalsContact
      && (flatHersteller.length > structured.length + 14 || structPackedLen < 16)
      && (!structSignalsContact || flatHersteller.length > structured.length + 28)
    ) {
      return flatHersteller;
    }
  }

  if (structured) {
    return structured;
  }
  return flatHersteller;
}

/** Kurz für Hero-Badge — erste sinnvolle Zeile, nicht der komplette SDB-Kontaktblock. */
function manufacturerHeroLabel(raw: Record<string, unknown>, p: EsprProductData): string {
  const docChunk = pickManufacturerDocumentChunk(raw)?.trim();
  if (docChunk) {
    const firstLine =
      docChunk.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0)
      ?? docChunk;
    const max = 76;
    if (firstLine.length <= max) {
      return firstLine;
    }
    return `${firstLine.slice(0, max - 1)}…`;
  }

  const rich = formatManufacturerRichText(raw, p.manufacturer);
  let first =
    rich
      ?.split(/\n/)
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? '';

  if (!first || /^[+.\d\s()/-]{12,}$/i.test(first)) {
    first = p.manufacturer.name.trim()
      || (typeof p.hersteller === 'string' ? p.hersteller.split(/\n/)[0]?.trim() : '')
      || first;
  }

  const max = 76;
  if (first.length > max) {
    return `${first.slice(0, max - 1)}…`;
  }
  return first;
}

function readDisplayProductName(raw: Record<string, unknown>, p: EsprProductData): string {
  const candidateValues = [
    raw.productName,
    raw.modellname,
    raw.model,
    p.modellname,
    p.model,
  ];

  for (const candidate of candidateValues) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate;
    }
  }

  return 'Digitaler Produktpass';
}

function ConfidenceBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const ring =
    pct >= 75 ? 'bg-emerald-50 text-emerald-800 ring-emerald-200/70' :
    pct >= 50 ? 'bg-amber-50 text-amber-900 ring-amber-200/70' :
                'bg-rose-50 text-rose-800 ring-rose-200/70';
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${ring}`}
    >
      Konfidenz {pct}%
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProductPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { d } = await searchParams;

  // Primary: store lookup
  let raw: Record<string, unknown> | undefined = await getProductById(id) as unknown as Record<string, unknown> | undefined;

  // Fallback: product data encoded in QR URL (?d=…)
  if (!raw && d) {
    try {
      const decoded = JSON.parse(decodeURIComponent(d));
      if (decoded?.id && decoded?.type) raw = decoded;
    } catch {
      console.warn('[ProductPage] URL-Dekodierung fehlgeschlagen');
    }
  }

  if (!raw) return notFound();

  const manufacturer = asRecord(raw.manufacturer);
  const carbonFootprint = asRecord(raw.carbonFootprint);
  const recycledContent = asRecord(raw.recycledContent);
  const lifecycle = asRecord(raw.lifecycle);
  const endOfLife = asRecord(raw.endOfLife);
  const productType = asString(raw.type) as EsprProductData['type'] | undefined;

  // Map to EsprProductData — handles both new schema and legacy BatteryDPP
  const p: EsprProductData = {
    id:        asString(raw.id) ?? id,
    createdAt: raw.createdAt instanceof Date ? raw.createdAt.toISOString() : (asString(raw.createdAt) ?? new Date().toISOString()),
    language:  asString(raw.language) ?? 'de',
    type:      productType ?? 'BATTERY',

    manufacturer: manufacturer
      ? {
          name:
            asString(manufacturer.name)?.trim()
            ?? (typeof raw.hersteller === 'string' ? raw.hersteller.split(/\n/)[0]?.trim() : undefined)
            ?? '',
          address: asString(manufacturer.address)?.trim(),
          country: asString(manufacturer.country)?.trim(),
          eoriNumber: asString(manufacturer.eoriNumber)?.trim(),
          phone: pickFirstStringFromRecord(manufacturer, [
            'phone',
            'telephone',
            'tel',
            'Telefon',
            'telefon',
            'phoneNumber',
          ]),
          email: pickFirstStringFromRecord(manufacturer, [
            'email',
            'eMail',
            'mail',
            'E-Mail',
            'contactEmail',
            'kontaktEmail',
          ]),
          website: pickFirstStringFromRecord(manufacturer, [
            'website',
            'url',
            'web',
            'homepage',
            'Homepage',
            'internet',
          ]),
        }
      : {
          name:
            (typeof raw.hersteller === 'string' ? raw.hersteller.split(/\n/)[0]?.trim() : undefined)
            ?? '',
        },
    hersteller:    asString(raw.hersteller)   ?? asString(manufacturer?.name) ?? '',
    model:         asString(raw.model)        ?? asString(raw.modellname) ?? '',
    modellname:    asString(raw.modellname)   ?? asString(raw.model) ?? '',

    serialNumber:   asString(raw.serialNumber)   ?? asString(raw.seriennummer),
    batchNumber:    asString(raw.batchNumber),
    productionDate: asString(raw.productionDate) ?? asString(raw.produktionsdatum),

    capacityKwh:    asNumber(raw.capacityKwh)    ?? asNumber(raw.kapazitaetKWh),
    chemistry:      asString(raw.chemistry)      ?? asString(raw.chemischesSystem),
    batteryType:    asString(raw.batteryType)    ?? asString(raw.batterietyp),
    nominalVoltageV: asNumber(raw.nominalVoltageV) ?? asNumber(raw.nennspannungV),
    weightKg:       asNumber(raw.weightKg)       ?? asNumber(raw.gewichtKg),

    carbonFootprint: carbonFootprint ? {
      totalKg:   asNumber(carbonFootprint.totalKg) ?? asNumber(raw.co2FussabdruckKgGesamt),
      perKwhKg:  asNumber(carbonFootprint.perKwhKg) ?? asNumber(raw.co2FussabdruckKgProKwh),
      methodology: asString(carbonFootprint.methodology),
      certificationBody: asString(carbonFootprint.certificationBody),
    } : {
      totalKg:   asNumber(raw.co2FussabdruckKgGesamt),
      perKwhKg:  asNumber(raw.co2FussabdruckKgProKwh),
    },

    recycledContent: recycledContent ? {
      cobaltPct:  asNumber(recycledContent.cobaltPct) ?? asNumber(raw.recyclinganteilKobalt),
      lithiumPct: asNumber(recycledContent.lithiumPct) ?? asNumber(raw.recyclinganteilLithium),
      nickelPct:  asNumber(recycledContent.nickelPct) ?? asNumber(raw.recyclinganteilNickel),
      leadPct: asNumber(recycledContent.leadPct),
    } : {
      cobaltPct:  asNumber(raw.recyclinganteilKobalt),
      lithiumPct: asNumber(raw.recyclinganteilLithium),
      nickelPct:  asNumber(raw.recyclinganteilNickel),
    },

    lifecycle: lifecycle ? {
      expectedCycles:          asNumber(lifecycle.expectedCycles) ?? asNumber(raw.erwarteteLebensdauerLadezyklen),
      repairabilityScore:      asNumber(lifecycle.repairabilityScore) ?? asNumber(raw.reparierbarkeitsIndex),
      sparePartsAvailableYears: asNumber(lifecycle.sparePartsAvailableYears) ?? asNumber(raw.ersatzteileVerfuegbarkeitJahre),
      warrantyYears: asNumber(lifecycle.warrantyYears),
    } : {
      expectedCycles:          asNumber(raw.erwarteteLebensdauerLadezyklen),
      repairabilityScore:      asNumber(raw.reparierbarkeitsIndex),
      sparePartsAvailableYears: asNumber(raw.ersatzteileVerfuegbarkeitJahre),
    },

    endOfLife: endOfLife ? {
      recyclingInstructions: asString(endOfLife.recyclingInstructions) ?? asString(raw.recyclingAnweisungen),
      disposalInstructions:
        asString(endOfLife.disposalInstructions)
        ?? asString(raw.endOfLifeInstructions)
        ?? asString(raw.entsorgungshinweise),
      hazardousSubstances: asStringArray(endOfLife.hazardousSubstances),
    } : {
      recyclingInstructions: asString(raw.recyclingAnweisungen),
      disposalInstructions:
        asString(raw.endOfLifeInstructions)
        ?? asString(raw.entsorgungshinweise),
    },

    certificationBody:   asString(raw.certificationBody)   ?? asString(raw.zertifizierungsstelle),
    regulatoryReference: asString(raw.regulatoryReference) ?? asString(raw.referenznummer),
    legalNotes:          asString(raw.legalNotes)          ?? asString(raw.rechtlicheHinweise),

    extractionConfidence: asNumber(raw.extractionConfidence) ?? 1,
    extractionWarnings:   asStringArray(raw.extractionWarnings),
  };

  const hasWarnings = p.extractionWarnings.length > 0;
  const expiryYear = new Date(p.createdAt).getFullYear() + 15;
  const displayProductName = readDisplayProductName(raw, p);

  const manufacturerPublication = resolveManufacturerPublication(raw, p);
  const manufacturerDisplayBlock = manufacturerPublication.displayText;

  const manufacturerBadgeLabel =
    manufacturerHeroLabel(raw, p).trim()
    || p.hersteller.trim()
    || p.manufacturer.name.trim()
    || '—';

  const chemicalCompositionSankey = tryChemicalCompositionToSankey(
    raw.chemicalComposition,
    displayProductName,
  );
  const enrichmentReview = asRecord(raw.enrichmentReview);
  const enrichmentFields = asStringArray(enrichmentReview?.enrichedFields);
  const enrichmentSources = asStringArray(enrichmentReview?.sourceUrls);
  const ragSuppliedFields = asStringArray(raw.ragSuppliedFieldKeys);
  const isReviewRequired = asString(raw.complianceStatus) === 'REVIEW_REQUIRED'
    || asString(enrichmentReview?.status) === 'PENDING';

  return (
    <div className="min-h-screen bg-[#eef1f8] pb-4">
      {/* Top bar — Circularise-Style App-Rahmen */}
      <nav className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/90 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0c1929] text-[11px] font-bold leading-none text-white">
              DPP
            </span>
            <span className="text-sm font-bold tracking-tight text-[#0c1929]">
              flash <span className="font-normal text-slate-400">· Produktpass</span>
            </span>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100"
            aria-label="Menü"
          >
            <Menu className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>
      </nav>

      {/* Hero */}
      <header className="relative border-b border-slate-200/80 bg-white">
        <div
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 via-[#0c1929] to-sky-500"
          aria-hidden
        />
        <div className="mx-auto max-w-4xl px-6 pb-10 pt-10 text-center sm:px-8">
          <div className="mb-4 flex justify-center">
            <div className="inline-flex flex-wrap items-center justify-center gap-2">
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ring-1 ring-inset ${
                  isReviewRequired
                    ? 'bg-amber-50 text-amber-900 ring-amber-200/80'
                    : 'bg-emerald-50 text-emerald-800 ring-emerald-200/80'
                }`}
              >
                <ShieldCheck size={14} strokeWidth={2} aria-hidden />
                {isReviewRequired ? 'Review erforderlich' : 'EU-Konform'}
                <span className="text-[10px] font-semibold text-slate-500 normal-case tracking-normal">
                  · ESPR 2024/1781
                </span>
              </span>
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0c1929] sm:text-3xl">
            {displayProductName}
          </h1>
          <p className="mt-2 text-sm font-medium text-slate-500">Digitaler Produktpass</p>
          <p className="mt-3">
            <code className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs text-slate-600 ring-1 ring-slate-200/80">
              {p.id}
            </code>
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-[#0c1929] ring-1 ring-slate-200/80">
              <Battery className="h-4 w-4 text-sky-600" strokeWidth={2} aria-hidden />
              {manufacturerBadgeLabel} <span className="text-slate-400">·</span> {p.modellname || '—'}
            </span>
          </div>
          <div className="mt-4 flex justify-center">
            <ConfidenceBadge score={p.extractionConfidence} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 px-4 py-8 sm:px-6 sm:space-y-6">

        {/* ── Extraction warnings ── */}
        {hasWarnings && (
          <div className="rounded-2xl border border-amber-200/90 bg-amber-50/90 px-5 py-4 shadow-sm ring-1 ring-amber-900/[0.04]">
            <div className="flex items-start gap-2 text-amber-700">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold mb-1">Hinweise zur Datenqualität</p>
                <ul className="text-sm space-y-0.5">
                  {p.extractionWarnings.map((w, i) => (
                    <li key={i}>• {w}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {isReviewRequired && (
          <div className="space-y-3 rounded-2xl border border-amber-200/90 bg-amber-50/80 px-5 py-5 shadow-sm ring-1 ring-amber-900/[0.04]">
            <p className="text-sm font-semibold text-yellow-800">
              Enrichment-Werte wurden automatisch aus Web-Quellen ergänzt. Bitte prüfen und bestätigen.
            </p>
            {enrichmentSources.length > 0 ? (
              <ul className="text-sm text-yellow-900 space-y-1">
                {enrichmentSources.map((url) => (
                  <li key={url}>
                    <a href={url} target="_blank" rel="noreferrer" className="underline hover:no-underline">
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
            <form action="/api/products/validate" method="post">
              <input type="hidden" name="productId" value={p.id} />
              <input type="hidden" name="returnUrl" value={`/p/${p.id}`} />
              <button
                type="submit"
                className="inline-flex items-center rounded-md bg-yellow-600 px-3 py-2 text-sm font-semibold text-white hover:bg-yellow-700"
              >
                Daten validieren
              </button>
            </form>
          </div>
        )}

        {/* ── Identity ── */}
        <Section icon={Building2} title="Allgemeine Informationen" subtitle="Identität & Kennzeichnung">
          {manufacturerDisplayBlock ? (
            <Field
              label="Hersteller / Verantwortlicher"
              value={manufacturerDisplayBlock}
              multiline
              sourceBadge={
                manufacturerPublication.showedDocumentChunk
                  ? 'Dokumentbeleg'
                  : ragSuppliedFields.includes('hersteller')
                    ? 'RAG'
                    : undefined
              }
            />
          ) : null}
          <ReviewField
            label="Ursprungsland"
            value={typeof raw.countryOfOrigin === 'string' ? raw.countryOfOrigin : undefined}
            highlighted={enrichmentFields.includes('countryOfOrigin')}
          />
          <Field label="Herstellungsland"  value={typeof raw.countryOfManufacturing === 'string' ? raw.countryOfManufacturing : undefined} />
          <Field label="Modell"            value={p.modellname} />
          <Field label="Seriennummer"      value={p.serialNumber} />
          <Field label="Chargennummer"     value={p.batchNumber} />
          <Field label="Herstellungsdatum" value={p.productionDate} />
          <Field label="Erstellt am"       value={new Date(p.createdAt).toLocaleDateString('de-DE')} />
        </Section>

        {/* ── Technical spec ── */}
        <Section icon={Cpu} title="Technische Spezifikation" subtitle="Technische Daten">
          <Field label="Kapazität"       value={p.capacityKwh !== undefined ? `${p.capacityKwh} kWh` : undefined} />
          <Field label="Chemisches System" value={p.chemistry} />
          <Field label="Batterietyp"     value={p.batteryType} />
          <Field label="Nennspannung"    value={p.nominalVoltageV !== undefined ? `${p.nominalVoltageV} V` : undefined} />
          <Field label="Gewicht"         value={p.weightKg !== undefined ? `${p.weightKg} kg` : undefined} />
        </Section>

        <IsccPlusSection
          raw={raw as Record<string, unknown>}
          productId={p.id}
          displayProductName={displayProductName}
        />

        <TraceabilitySection raw={raw as Record<string, unknown>} productDisplayName={displayProductName} />

        {chemicalCompositionSankey ? (
          <ChemicalCompositionFlowSection graph={chemicalCompositionSankey} />
        ) : null}

        {/* ── DPP Core fields (new extraction schema) ── */}
        <Section icon={FileStack} title="DPP-Kernfelder (ESPR)" subtitle="Regulatorische Datenblätter">
          <Field label="Produktname" value={typeof raw.productName === 'string' ? raw.productName : undefined} />
          <Field label="Abfallschluessel (EAK)" value={typeof raw.wasteCode === 'string' ? raw.wasteCode : undefined} />
          <Field label="UPI" value={typeof raw.upi === 'string' ? raw.upi : undefined} />
          <ReviewField
            label="GTIN"
            value={typeof raw.gtin === 'string' ? raw.gtin : undefined}
            highlighted={enrichmentFields.includes('gtin')}
            sourceBadge={ragSuppliedFields.includes('gtin') ? 'RAG' : undefined}
          />
          {renderMaterialZusammensetzungKernfelder(raw.materialComposition, raw.materialZusammensetzung)}
          {renderChemicalComposition(raw.chemicalComposition)}
          {renderRecycledContent(raw.recycledContent)}
          {renderCarbonFootprint(raw.carbonFootprint)}
          {renderEnvironmentalImpact(raw.environmentalImpact)}
          {renderUnifiedHazardousIngredients(raw.substancesOfConcern, raw.gefahrenstoffe)}
          {renderSupplierAndProcessInformation(raw.supplierAndProcessInformation)}
          {renderCareRepairDurability(raw.careRepairDurability)}
          <Field
            label="End-of-Life-Hinweise"
            value={
              typeof raw.endOfLifeInstructions === 'string'
                ? raw.endOfLifeInstructions
                : typeof raw.entsorgungshinweise === 'string'
                  ? raw.entsorgungshinweise
                  : undefined
            }
          />
        </Section>

        <RagProvenanceSection ragEnrichment={raw.ragEnrichment} />

        {/* ── Carbon footprint (Art. 7) ── */}
        <Section icon={Globe2} title="CO₂-Fußabdruck" subtitle="Art. 7 EU 2023/1542">
          <Field label="Gesamt (kg CO₂e)"   value={p.carbonFootprint.totalKg} />
          <Field label="Pro kWh (kg CO₂e)"  value={p.carbonFootprint.perKwhKg} />
          <Field label="Methodik"            value={p.carbonFootprint.methodology} />
          <Field label="Zertifizierer"       value={p.carbonFootprint.certificationBody} />
        </Section>

        {/* ── Recycled content (Art. 8) ── */}
        <Section icon={Recycle} title="Recyclinganteile" subtitle="Art. 8 EU 2023/1542">
          <Pct label="Kobalt"   value={p.recycledContent.cobaltPct} />
          <Pct label="Lithium"  value={p.recycledContent.lithiumPct} />
          <Pct label="Nickel"   value={p.recycledContent.nickelPct} />
          <Pct label="Blei"     value={p.recycledContent.leadPct} />
        </Section>

        {/* ── Lifecycle (Art. 10) ── */}
        <Section icon={Gauge} title="Lebensdauer & Reparierbarkeit" subtitle="Art. 10 EU 2023/1542">
          <Field label="Erwartete Ladezyklen"  value={p.lifecycle.expectedCycles} />
          <Field label="Reparierbarkeitsindex" value={p.lifecycle.repairabilityScore !== undefined ? `${p.lifecycle.repairabilityScore} / 10` : undefined} />
          <Field label="Ersatzteil-Verfügbarkeit" value={p.lifecycle.sparePartsAvailableYears !== undefined ? `${p.lifecycle.sparePartsAvailableYears} Jahre` : undefined} />
          <Field label="Garantie"              value={p.lifecycle.warrantyYears !== undefined ? `${p.lifecycle.warrantyYears} Jahre` : undefined} />
        </Section>

        {/* ── End-of-life (Art. 11) ── */}
        <Section icon={Trash2} title="Entsorgung & Recycling" subtitle="Art. 11 EU 2023/1542">
          <Field label="Recyclinganweisungen"  value={p.endOfLife.recyclingInstructions} />
          <Field label="Entsorgungshinweise"   value={p.endOfLife.disposalInstructions} />
          {p.endOfLife.hazardousSubstances?.length ? (
            <Field label="Gefahrstoffe" value={p.endOfLife.hazardousSubstances.join(', ')} />
          ) : null}
        </Section>

        {/* ── Regulatory ── */}
        <Section icon={ClipboardList} title="Zertifizierung & Compliance" subtitle="Referenzen & Hinweise">
          <Field label="Zertifizierungsstelle" value={p.certificationBody} />
          <Field label="Rechtsgrundlage"        value={p.regulatoryReference} />
          <Field label="Rechtliche Hinweise"    value={p.legalNotes} />
          <Field label="Lieferkette"            value={p.supplyChainInfo} />
        </Section>

      </main>

      <footer className="mt-4 border-t border-slate-200/90 bg-[#0c1929] px-6 py-12 text-center text-sm text-slate-400">
        <p className="font-semibold tracking-wide text-slate-300">Digital Product Pass</p>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          Datenverfügbarkeit garantiert bis {expiryYear} gemäß EU-Verordnung.
          <span className="mx-2 text-slate-600">·</span>
          100&nbsp;% lokal verarbeitet · DSGVO-konform
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-2 text-[11px] font-medium uppercase tracking-wider text-slate-500">
          <span>Über DPPflash</span>
          <span>Partner</span>
          <span>Produkte</span>
        </div>
      </footer>
    </div>
  );
}
