import { getProductById } from '../../lib/mock-data';
import { notFound } from 'next/navigation';
import {
  Menu,
  Recycle,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import type { EsprProductData } from '../../types/espr';
import {
  coerceMaterialCompositionArray,
  tryChemicalCompositionToSankey,
} from '@/app/domain/dpp/materialCompositionToSankey';
import { normalizeGhsPictogramCodeList } from '@/app/domain/rag/ghsPictogramCodes';
import {
  extractHazardStatementCodesFromTexts,
  extractPrecautionaryStatementCodesFromTexts,
  normalizeHazardStatementCodeList,
  normalizePrecautionaryStatementCodeList,
} from '@/app/domain/rag/hazardStatementCodes';
import { ComplianceDocumentsSection } from './ComplianceDocumentsSection';
import { GhsPictogramBadges } from './GhsPictogramBadges';
import { parseComplianceSourceDocuments } from '@/app/domain/rag/sourceDocuments';
import { RagProvenanceSection } from './RagProvenanceSection';
import { TraceabilitySection } from './TraceabilitySection';
import { ChemicalCompositionFlowSection } from './ChemicalCompositionFlowSection';
import { IsccPlusSection } from './IsccPlusSection';
import { EnvironmentalFootprintSection } from './EnvironmentalFootprintSection';
import { HumanReviewStatusBar } from './HumanReviewStatusBar';
import { ProductImageCard } from './ProductImageCard';
import { Avv170106DisposalDetailCard } from './Avv170106DisposalDetailCard';
import { shouldShowAvv170106DisposalDetail } from '@/app/domain/dpp/waste/avv170106DisposalGuidance';
import { isRagProvenanceEnvelope } from '@/app/domain/rag/mergeRagAuditIntoPassport';

// ─── Page contract ────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ d?: string }>;
}

// ─── Presentational helpers ───────────────────────────────────────────────────

function Section({
  children,
  title,
  subtitle,
  icon: Icon = Recycle,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  icon?: LucideIcon;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_28px_-6px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/[0.04]">
      {title ? (
        <header className="flex items-start gap-3 bg-[#0c1929] px-5 py-4 text-white">
          <div
            className="flex shrink-0 items-center justify-center rounded-xl bg-white/[0.12] p-2.5"
            aria-hidden
          >
            <Icon size={22} strokeWidth={1.75} className="text-amber-300" />
          </div>
          <div className="min-w-0 pt-0.5">
            <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
            {subtitle ? (
              <p className="mt-1 text-[11px] font-semibold uppercase leading-snug tracking-[0.14em] text-slate-400">
                {subtitle}
              </p>
            ) : null}
          </div>
        </header>
      ) : null}
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

function HazardCodesField({
  label,
  codes,
  sourceBadge,
}: {
  label: string;
  codes: readonly string[];
  sourceBadge?: string;
}) {
  if (codes.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-0.5 px-5 py-3.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <dt className="text-[13px] font-medium leading-snug text-slate-500 sm:w-[40%] sm:shrink-0">{label}</dt>
      <dd className="text-[13px] font-semibold leading-snug text-slate-900 sm:max-w-[58%] sm:text-right">
        <span className="font-mono tracking-tight">{codes.join(', ')}</span>
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

type ChemicalCompositionDisplayRow = {
  readonly material: string;
  readonly percentage: string;
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

function renderChemicalCompositionTable(label: string, rows: readonly ChemicalCompositionDisplayRow[]) {
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
                <th className="px-3 py-2.5">Material</th>
                <th className="px-3 py-2.5 whitespace-nowrap">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={`${label}-${r.material}-${i}`} className="bg-white">
                  <td className="px-3 py-2 font-semibold text-slate-900">{r.material}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-600">{r.percentage}</td>
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

  const sdsRows = (sdsFromMz.length > 0 ? sdsFromMz : sdsFromMc).filter(
    (row) => !isSyntheticFillerMaterialName(row.stoffname),
  );
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
      if (!title || isSyntheticFillerMaterialName(title)) {
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
  const legacyRaw =
    typeof materialZusammensetzung === 'string' && materialZusammensetzung.trim().length > 0
      ? materialZusammensetzung.trim()
      : typeof mzInner === 'string' && mzInner.trim().length > 0 && !mzInner.trim().startsWith('[')
        ? mzInner.trim()
        : undefined;
  const legacy =
    legacyRaw && !isSyntheticFillerCompositionText(legacyRaw) ? legacyRaw : undefined;

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

/** Rechnerischer Platzhalter aus der Extraktion — nicht im DPP anzeigen. */
function isSyntheticFillerMaterialName(name: string): boolean {
  const lower = name.trim().toLowerCase();
  return /nicht\s+deklarationspflichtig/.test(lower)
    || /^sonstige\s+bestandteile\b/.test(lower)
    || /^restanteil\b/.test(lower)
    || (/\bf(ü|ue)llstoffe?\b/.test(lower) && /\b100\s*%/.test(name));
}

function isSyntheticFillerCompositionText(text: string): boolean {
  const stripped = text.replace(/\(\s*\d+(?:[.,]\d+)?\s*%\s*\)/g, ' ').trim();
  return isSyntheticFillerMaterialName(stripped) || isSyntheticFillerMaterialName(text);
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

type SubstanceOfConcernDisplayRow = {
  readonly name: string;
  readonly casDisplay: string;
  readonly hDisplay: string;
  readonly pDisplay: string;
  readonly hCodes: readonly string[];
  readonly ghsCodes: readonly string[];
};

function normalizeHazardCodeCandidate(v: unknown): unknown {
  let x = unwrapProvenanceInner(v);
  if (x && typeof x === 'object' && !Array.isArray(x)) {
    const o = x as Record<string, unknown>;
    if ('value' in o && ('confidence' in o || 'source' in o || 'requiresManualReview' in o)) {
      x = o.value;
    }
  }
  return x;
}

function collectDistinctHStatements(...vals: unknown[]): string[] {
  const chunks: unknown[] = [];
  for (const val of vals) {
    chunks.push(normalizeHazardCodeCandidate(val));
  }
  return normalizeHazardStatementCodeList(chunks);
}

function collectDistinctPStatements(...vals: unknown[]): string[] {
  const chunks: unknown[] = [];
  for (const val of vals) {
    chunks.push(normalizeHazardCodeCandidate(val));
  }
  return normalizePrecautionaryStatementCodeList(chunks);
}

/** GHS-Piktogramme inkl. numerischer Codes (`05` → `GHS05`). */
function collectDistinctGhsCodes(...vals: unknown[]): string[] {
  const chunks: unknown[] = [];
  for (const val of vals) {
    const v = normalizeHazardCodeCandidate(val);
    if (v === undefined || v === null) {
      continue;
    }
    if (Array.isArray(v)) {
      chunks.push(...v);
    } else if (typeof v === 'string' && v.trim()) {
      chunks.push(
        ...v.split(/[,;]|(?=\s+GHS\s*0?[1-9]\b)/i).map((s) => s.trim()).filter(Boolean),
      );
    } else if (typeof v === 'number' && Number.isFinite(v)) {
      chunks.push(v);
    }
  }
  return normalizeGhsPictogramCodeList(chunks);
}

function readRagAuditTrailFieldValues(raw: Record<string, unknown>, keys: readonly string[]): unknown[] {
  const rag = raw.ragEnrichment;
  if (!rag || typeof rag !== 'object' || Array.isArray(rag)) {
    return [];
  }
  const ragRec = rag as Record<string, unknown>;
  if (ragRec.success !== true) {
    return [];
  }
  const trail = ragRec.auditTrail;
  if (!trail || typeof trail !== 'object' || Array.isArray(trail)) {
    return [];
  }
  const fields = (trail as Record<string, unknown>).fields;
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
    return [];
  }
  const vals: unknown[] = [];
  for (const key of keys) {
    const entry = (fields as Record<string, unknown>)[key];
    if (entry && typeof entry === 'object' && !Array.isArray(entry) && 'value' in entry) {
      vals.push((entry as Record<string, unknown>).value);
    }
  }
  return vals;
}

function extractHpCodesFromComposition(
  raw: Record<string, unknown>,
  kind: 'h' | 'p',
): string[] {
  const comp =
    parseHazardFieldToStructuredArray(raw.chemicalComposition)
    ?? parseHazardFieldToStructuredArray(raw.materialComposition)
    ?? parseHazardFieldToStructuredArray(raw.zusammensetzung);
  if (!comp?.length) {
    return [];
  }
  const texts: string[] = [];
  for (const entry of comp) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }
    const o = entry as Record<string, unknown>;
    for (const k of ['einstufung', 'hinweis', 'stoffname', 'substance', 'classification', 'hazardClass']) {
      if (typeof o[k] === 'string' && o[k].trim()) {
        texts.push(o[k]);
      }
    }
  }
  return kind === 'h'
    ? extractHazardStatementCodesFromTexts(texts)
    : extractPrecautionaryStatementCodesFromTexts(texts);
}

function resolveSubstancesOfConcernInner(raw: Record<string, unknown>): unknown[] | null {
  const sources: unknown[] = [
    raw.substancesOfConcern,
    raw.gefahrenstoffe,
    ...readRagAuditTrailFieldValues(raw, ['substancesOfConcern', 'gefahrenstoffe']),
  ];
  for (const src of sources) {
    const inner = parseHazardFieldToStructuredArray(src);
    if (inner?.length) {
      return inner;
    }
    const unwrapped = unwrapProvenanceInner(src);
    if (Array.isArray(unwrapped) && unwrapped.length > 0) {
      return unwrapped;
    }
  }
  return null;
}

function aggregateSubstanceRowHazardCodes(
  raw: Record<string, unknown>,
  kind: 'h' | 'p' | 'ghs',
): string[] {
  const inner = resolveSubstancesOfConcernInner(raw);
  if (!inner?.length || inner.every((x) => typeof x === 'string')) {
    return [];
  }
  const hKeys = ['hStatements', 'hazardStatements', 'hSaetze'] as const;
  const pKeys = ['pStatements', 'precautionaryStatements', 'pSaetze'] as const;
  const gKeys = ['ghsPictograms', 'ghsSymbols', 'gefahrenpiktogramme'] as const;
  const keys = kind === 'h' ? hKeys : kind === 'p' ? pKeys : gKeys;
  const vals: unknown[] = [];
  for (const entry of inner) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }
    const o = entry as Record<string, unknown>;
    for (const k of keys) {
      vals.push(o[k]);
    }
  }
  if (kind === 'ghs') {
    return collectDistinctGhsCodes(...vals);
  }
  if (kind === 'p') {
    return collectDistinctPStatements(...vals);
  }
  return collectDistinctHStatements(...vals);
}

function resolveProductLevelHazardCodes(
  raw: Record<string, unknown>,
  passportKeys: readonly string[],
  synonymKeys: readonly string[],
): string[] {
  const passportVals = synonymKeys.flatMap((k) => [unwrapProvenanceInner(raw[k]), raw[k]]);
  const trailVals = readRagAuditTrailFieldValues(raw, passportKeys);
  const direct = collectDistinctPStatements(...passportVals, ...trailVals);
  if (direct.length > 0) {
    return direct;
  }
  const fromSubstances = aggregateSubstanceRowHazardCodes(raw, 'p');
  if (fromSubstances.length > 0) {
    return fromSubstances;
  }
  return extractHpCodesFromComposition(raw, 'p');
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
    } else if (t.length > 0) {
      const lines = t.split(/\n+/).map((s) => s.trim()).filter(Boolean);
      return lines.length > 0 ? lines : null;
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
    if (typeof entry === 'string' && entry.trim()) {
      const label = entry.trim();
      const hCodes = extractHazardStatementCodesFromTexts([label]);
      rows.push({
        name: label,
        casDisplay: '—',
        hCodes,
        hDisplay: formatCodeCellDisplay(hCodes),
        pDisplay: formatCodeCellDisplay(extractPrecautionaryStatementCodesFromTexts([label])),
        ghsCodes: collectDistinctGhsCodes(label),
      });
      continue;
    }
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

    const hCodes = collectDistinctHStatements(
      o.hStatements,
      o.hazardStatements,
      o.hSaetze,
      o.einstufung,
      o.hinweis,
      o.hazardClass,
    );
    const pCodes = collectDistinctPStatements(
      o.pStatements,
      o.precautionaryStatements,
      o.pSaetze,
      o.einstufung,
      o.hinweis,
    );
    const gCodes = collectDistinctGhsCodes(o.ghsPictograms, o.ghsSymbols, o.gefahrenpiktogramme);

    rows.push({
      name,
      casDisplay,
      hCodes,
      hDisplay: formatCodeCellDisplay(hCodes),
      pDisplay: formatCodeCellDisplay(pCodes),
      ghsCodes: gCodes,
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
        Besorgniserregende / bedenkliche Stoffe{' '}
        <span className="block pt-0.5 text-[11px] font-normal uppercase tracking-wide text-slate-400">
          Bedenkliche Stoffe · CAS · GHS · H/P
        </span>
      </dt>
      <dd className="min-w-0 flex-1 text-[13px] text-slate-900 sm:max-w-[62%]">
        <div className="overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-sm">
          <table className="min-w-full table-fixed text-left text-[13px]">
            <thead className="bg-amber-50/90 text-[11px] font-bold uppercase tracking-wider text-slate-700">
              <tr>
                <th className="px-3 py-2.5 w-[25%]">Material</th>
                <th className="px-3 py-2.5 whitespace-nowrap w-[16%]">CAS-Nummer</th>
                <th className="px-3 py-2.5 w-[19%]">GHS-Symbole</th>
                <th className="px-3 py-2.5 w-[20%]">H-Sätze</th>
                <th className="px-3 py-2.5 w-[20%]">P-Sätze</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={`${r.name}-${r.casDisplay}-${i}`} className="bg-white align-top">
                  <td className="px-3 py-2 font-semibold text-slate-900 break-words">{r.name}</td>
                  <td className="px-3 py-2 whitespace-nowrap font-mono text-[12px] text-slate-800">{r.casDisplay}</td>
                  <td className="px-3 py-2">
                    {r.ghsCodes.length > 0 || r.hCodes.length > 0 ? (
                      <GhsPictogramBadges codes={r.ghsCodes} hStatementsForInference={r.hCodes} />
                    ) : (
                      <span className="font-mono text-[12px] text-slate-500">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-700 break-words text-[12px] leading-snug">{r.hDisplay}</td>
                  <td className="px-3 py-2 text-slate-700 break-words text-[12px] leading-snug">{r.pDisplay}</td>
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
function renderUnifiedHazardousIngredients(raw: Record<string, unknown>) {
  const inner = resolveSubstancesOfConcernInner(raw);
  if (!inner?.length) {
    return null;
  }
  const rows = parseSubstancesOfConcernRows(inner);
  if (rows.length === 0) {
    return null;
  }
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
    return renderChemicalCompositionTable(
      'Chemische Zusammensetzung',
      tableRows.map((row) => ({
        material: row.stoffname,
        percentage: row.konzentration,
      })),
    );
  }

  const entries = inner.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];

    const row = entry as Record<string, unknown>;
    const material =
      materialNameFromCompositionEntry(row)
      || ('substance' in row && typeof row.substance === 'string' ? row.substance.trim() : '')
      || ('stoffname' in row && typeof row.stoffname === 'string' ? row.stoffname.trim() : '')
      || undefined;

    const pctFromStructured =
      'prozentAnteil' in row && typeof row.prozentAnteil === 'string' && row.prozentAnteil.trim()
        ? row.prozentAnteil.trim()
        : undefined;
    const concentration =
      'concentrationPercent' in row
        ? formatPercentage(row.concentrationPercent)
        : undefined;
    const pct = pickMaterialCompositionPercent(row);
    const percentage = pctFromStructured ?? concentration ?? (pct !== undefined ? formatPercentage(pct) : undefined);

    if (!material) return [];

    return [{
      title: material,
      details: percentage,
    }];
  });

  return renderKeyValueList('Chemische Zusammensetzung', entries);
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
function scoreManufacturerChunkRichness(text: string): number {
  let score = text.trim().length;
  if (/[@+]|\btel\b|telefon|fax|e-mail|https?:\/\//i.test(text)) {
    score += 500;
  }
  if (text.includes('\n')) {
    score += 200;
  }
  return score;
}

function pickBestManufacturerChunk(candidates: readonly string[]): string | undefined {
  const unique = [...new Set(candidates.map((c) => c.trim()).filter(Boolean))];
  if (unique.length === 0) {
    return undefined;
  }
  return unique.sort((a, b) => scoreManufacturerChunkRichness(b) - scoreManufacturerChunkRichness(a))[0];
}

function pickManufacturerDocumentChunk(raw: Record<string, unknown>): string | undefined {
  const candidates: string[] = [];

  const push = (value: unknown) => {
    const snippet = provenanceContextSnippet(value);
    if (snippet) {
      candidates.push(snippet);
    }
    if (isRagProvenanceEnvelope(value)) {
      const inner = (value as Record<string, unknown>).value;
      if (typeof inner === 'string' && inner.trim()) {
        candidates.push(inner.trim());
      }
    } else if (typeof value === 'string' && value.trim()) {
      candidates.push(value.trim());
    }
  };

  push(raw.hersteller);
  push(raw.manufacturer);
  push(raw.Hersteller);

  const enrichment = raw.ragEnrichment;
  const enrichmentRecord =
    typeof enrichment === 'object' && enrichment !== null && !Array.isArray(enrichment)
      ? (enrichment as Record<string, unknown>)
      : undefined;
  if (
    enrichmentRecord
    && 'auditTrail' in enrichmentRecord
    && enrichmentRecord.success === true
  ) {
    const auditTrail = enrichmentRecord.auditTrail;
    if (auditTrail && typeof auditTrail === 'object' && !Array.isArray(auditTrail)) {
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
        const auditedRec = audited as Record<string, unknown>;
        const src = auditedRec.source;
        if (src && typeof src === 'object' && !Array.isArray(src)) {
          const snippetRaw = (src as Record<string, unknown>).contextSnippet;
          const sn = typeof snippetRaw === 'string' ? snippetRaw.trim() : '';
          if (sn.length > 0) {
            candidates.push(sn);
          }
        }
        const auditedValue = auditedRec.value;
        if (typeof auditedValue === 'string' && auditedValue.trim()) {
          candidates.push(auditedValue.trim());
        }
      }
    }
  }

  return pickBestManufacturerChunk(candidates);
}

/** Teilt eingebettete Kontaktzeilen (Tel./Fax/E-Mail …) von der Adresszeile. */
function splitInlineManufacturerContacts(text: string): string[] {
  return text
    .split(
      /\s+(?=(?:Tel\.?|Telefon|Telefax|Fax|E-Mail|E-mail|e-mail|Mail:|Email:|Internet:|Notruf:|www\.|https?:\/\/|\+?\d{2,3}[\s/-]?\(?\d{2,}))/gi,
    )
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function isOrphanHouseNumberLine(line: string): boolean {
  return /^\d+[a-zA-Z0-9/-]*$/.test(line.trim());
}

function isContactLine(line: string): boolean {
  return /^(?:tel\.?|telefon|telefax|fax|e-mail|email|mail:|internet:|notruf:|www\.|https?:\/\/|\+?\d)/i.test(line.trim());
}

/** Verhindert isolierte Hausnummern in eigener Zeile (Straße + Nr. zusammenhalten). */
function normalizeManufacturerLineBreaks(lines: readonly string[]): string[] {
  const normalized: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    if (isOrphanHouseNumberLine(trimmed) && normalized.length > 0) {
      normalized[normalized.length - 1] = `${normalized[normalized.length - 1]} ${trimmed}`;
      continue;
    }

    normalized.push(trimmed);
  }

  return normalized;
}

function splitCompanyAndStreetLine(beforePlz: string): { readonly company: string; readonly streetLine: string } | null {
  const patterns = [
    /^(.*\S)\s+((?:[A-Za-zäöüÄÖÜß][\wäöüÄÖÜß.\-/]*\s+)+[A-Za-zäöüÄÖÜß][\wäöüÄÖÜß.\-/]*\s+\d+[a-zA-Z0-9/-]*)$/,
    /^(.*\S)\s+([A-Za-zäöüÄÖÜß][\wäöüÄÖÜß.\-/]*\s+\d+[a-zA-Z0-9/-]*)$/,
  ];

  for (const pattern of patterns) {
    const match = beforePlz.match(pattern);
    if (match?.[1] && match[2]) {
      return {
        company: match[1].trim(),
        streetLine: match[2].trim(),
      };
    }
  }

  return null;
}

function polishManufacturerDisplayText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return trimmed;
  }

  const lines = normalizeManufacturerLineBreaks(
    trimmed.split(/\n+/).map((line) => line.trim()).filter(Boolean),
  );

  const polished = lines.flatMap((line) => {
    if (isContactLine(line) || line.includes('\n')) {
      return [line];
    }
    if (/\d{5}/.test(line) && !line.includes('\n')) {
      const formatted = formatFlatManufacturerBlock(line);
      return formatted.split('\n').map((entry) => entry.trim()).filter(Boolean);
    }
    return [line];
  });

  return normalizeManufacturerLineBreaks(polished).join('\n');
}

/** Voller Dokument-Chunk: mehrzeilig belassen, Kontaktdaten nicht abschneiden. */
function formatManufacturerDocumentChunk(text: string): string {
  const normalized = text.trim().replace(/\r\n/g, '\n');
  if (!normalized) {
    return normalized;
  }
  if (normalized.includes('\n')) {
    return polishManufacturerDisplayText(
      normalized
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .join('\n'),
    );
  }

  const segments = splitInlineManufacturerContacts(normalized);
  if (segments.length <= 1) {
    return formatFlatManufacturerBlock(normalized);
  }

  const [head, ...contacts] = segments;
  const formattedHead = head ? formatFlatManufacturerBlock(head) : '';
  return polishManufacturerDisplayText([formattedHead, ...contacts].filter(Boolean).join('\n'));
}

function normalizeManufacturerCompareLine(line: string): string {
  return line.trim().toLowerCase().replace(/\s+/g, '');
}

/** Ergänzt strukturierte Kontaktzeilen, die im Chunk noch fehlen (Tel./E-Mail …). */
function mergeManufacturerDisplayTexts(primary: string, secondary: string): string {
  if (!secondary.trim()) {
    return primary;
  }
  if (!primary.trim()) {
    return secondary;
  }

  const primaryNorm = primary
    .split('\n')
    .map(normalizeManufacturerCompareLine)
    .filter(Boolean);
  const primaryBlob = primaryNorm.join('|');

  const extras = secondary
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) {
        return false;
      }
      const norm = normalizeManufacturerCompareLine(line);
      if (!norm || primaryNorm.includes(norm)) {
        return false;
      }
      return !primaryBlob.includes(norm);
    });

  if (extras.length === 0) {
    return primary;
  }
  return [primary, ...extras].join('\n');
}

/** Wandelt einzeilige SDB-Herstellerblöcke in lesbare Zeilen (Firma · Straße · PLZ Ort · Land). */
function formatFlatManufacturerBlock(text: string): string {
  const t = text.trim();
  if (!t || t.includes('\n')) {
    return t;
  }

  const plzTail = t.match(/^(.+?)\s+(\d{5})\s+(.+)$/);
  if (!plzTail?.[1] || !plzTail[2] || !plzTail[3]) {
    return t;
  }

  const beforePlz = plzTail[1].trim();
  const plz = plzTail[2];
  const afterPlz = plzTail[3].trim();

  const streetSplit = splitCompanyAndStreetLine(beforePlz);
  const countryMatch = afterPlz.match(
    /^(.+?)\s+(Deutschland|Germany|Österreich|Austria|Schweiz|Switzerland|France|Frankreich|Italy|Italien|Spain|Spanien|Nederland|Netherlands|België|Belgium|Polska|Poland)$/i,
  );

  if (streetSplit) {
    const lines = [streetSplit.company, streetSplit.streetLine];
    if (countryMatch?.[1] && countryMatch[2]) {
      lines.push(`${plz} ${countryMatch[1].trim()}`, countryMatch[2]);
    } else {
      lines.push(`${plz} ${afterPlz}`);
    }
    return lines.join('\n');
  }

  if (countryMatch?.[1] && countryMatch[2]) {
    return [beforePlz, `${plz} ${countryMatch[1].trim()}`, countryMatch[2]].join('\n');
  }

  return [beforePlz, `${plz} ${afterPlz}`].join('\n');
}

/** Ergänzt Tel./E-Mail aus strukturierten Passport-Feldern, falls im Chunk noch nicht enthalten. */
function appendStructuredManufacturerContacts(
  displayText: string,
  raw: Record<string, unknown>,
  manufacturerView: EsprProductData['manufacturer'],
): string {
  const rec = asRecord(raw.manufacturer);
  const contactLines: string[] = [];

  const tel = formatTelDisplay(
    manufacturerView.phone
    ?? pickFirstStringFromRecord(rec, [
      'phone',
      'telephone',
      'tel',
      'Telefon',
      'telefon',
      'phoneNumber',
    ])
    ?? pickFirstStringFromRecord(raw, ['telefon', 'Telefon', 'phone', 'manufacturerPhone']),
  );
  if (tel) {
    contactLines.push(tel);
  }

  const fax = pickFirstStringFromRecord(rec, ['fax', 'Fax', 'Telefax']);
  if (fax && !/^(?:fax|telefax):/i.test(fax)) {
    contactLines.push(`Fax: ${fax}`);
  } else if (fax) {
    contactLines.push(fax);
  }

  const email =
    manufacturerView.email?.trim()
    ?? pickFirstStringFromRecord(rec, [
      'email',
      'eMail',
      'mail',
      'e-mail',
      'E-Mail',
      'contactEmail',
      'kontaktEmail',
    ])
    ?? pickFirstStringFromRecord(raw, ['email', 'E-Mail', 'eMail']);
  if (email) {
    contactLines.push(email);
  }

  const website =
    manufacturerView.website?.trim()
    ?? pickFirstStringFromRecord(rec, ['website', 'url', 'web', 'homepage', 'Homepage', 'internet']);
  if (website) {
    contactLines.push(website);
  }

  if (contactLines.length === 0) {
    return displayText;
  }

  return mergeManufacturerDisplayTexts(displayText, contactLines.join('\n'));
}

/** Priorisiert den vollständigen Dokument-Chunk (Abschnitt 1) inkl. Tel./E-Mail. */
function resolveManufacturerPublication(raw: Record<string, unknown>, p: EsprProductData): {
  readonly displayText: string;
} {
  const chunk = pickManufacturerDocumentChunk(raw)?.trim();
  const synthesized =
    formatManufacturerRichText(raw, p.manufacturer).trim()
    || p.manufacturer.name.trim()
    || (typeof raw.hersteller === 'string' ? raw.hersteller.trim() : '');

  const fromChunk = chunk ? formatManufacturerDocumentChunk(chunk) : '';
  const fromSynth = synthesized ? formatManufacturerDocumentChunk(synthesized) : '';

  const merged = fromChunk
    ? mergeManufacturerDisplayTexts(fromChunk, fromSynth)
    : fromSynth;

  return {
    displayText: polishManufacturerDisplayText(
      appendStructuredManufacturerContacts(merged, raw, p.manufacturer),
    ),
  };
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
    return formatFlatManufacturerBlock(preformatted);
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
      return formatFlatManufacturerBlock(flatHersteller);
    }
  }

  if (structured) {
    return formatFlatManufacturerBlock(structured);
  }
  return formatFlatManufacturerBlock(flatHersteller);
}


/**
 * Liest `handlingInstructions` bzw. `handlingAndApplicationInstructions` aus dem rohen
 * Pass-Objekt — sowohl als reiner String als auch eingewickelt in einen Provenance-Container
 * (`{ value, sourcePdf, contextSnippet, … }`) wie ihn die RAG-/Eager-Pipeline liefert.
 */
function pickHandlingInstructionsForDisplay(raw: Record<string, unknown>): string | undefined {
  const candidates: readonly unknown[] = [
    raw.handlingInstructions,
    raw.handlingAndApplicationInstructions,
    raw.verarbeitungshinweise,
    raw.hinweise,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
    const inner = unwrapProvenanceInner(candidate);
    if (typeof inner === 'string' && inner.trim().length > 0) {
      return inner.trim();
    }
  }
  return undefined;
}

function isHandlingInstructionsFromRag(raw: Record<string, unknown>): boolean {
  for (const key of [
    'handlingInstructions',
    'handlingAndApplicationInstructions',
    'verarbeitungshinweise',
    'hinweise',
  ] as const) {
    const candidate = raw[key];
    if (
      candidate
      && typeof candidate === 'object'
      && !Array.isArray(candidate)
      && 'sourcePdf' in candidate
    ) {
      return true;
    }
  }
  return false;
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

  const expiryYear = new Date(p.createdAt).getFullYear() + 15;
  const displayProductName = readDisplayProductName(raw, p);

  const manufacturerPublication = resolveManufacturerPublication(raw, p);
  const manufacturerDisplayBlock = manufacturerPublication.displayText;
  const productImageUrl = asString(raw.gtin) ? `/images/products/${asString(raw.gtin)}.png` : null;
  const showAvv170106DisposalDetail = shouldShowAvv170106DisposalDetail(
    asString(raw.wasteCode),
    asString(raw.ewcCode),
  );

  const chemicalCompositionSankey = tryChemicalCompositionToSankey(
    raw.chemicalComposition,
    displayProductName,
  );
  const enrichmentReview = asRecord(raw.enrichmentReview);
  const enrichmentFields = asStringArray(enrichmentReview?.enrichedFields);
  const enrichmentSources = asStringArray(enrichmentReview?.sourceUrls);
  const ragSuppliedFields = asStringArray(raw.ragSuppliedFieldKeys);
  const productLevelPStatements = resolveProductLevelHazardCodes(
    raw,
    ['pStatements'],
    ['pStatements', 'precautionaryStatements', 'pSaetze'],
  );
  const hazardFromRagAudit = (key: string) =>
    readRagAuditTrailFieldValues(raw, [key]).length > 0 && !ragSuppliedFields.includes(key);
  const complianceAttachments = parseComplianceSourceDocuments(
    raw.attachments ?? raw.downloadableDocuments,
  );
  const isReviewRequired = asString(raw.complianceStatus) === 'REVIEW_REQUIRED'
    || asString(enrichmentReview?.status) === 'PENDING';

  const hasRecycledContentSection =
    p.recycledContent.cobaltPct !== undefined
    || p.recycledContent.lithiumPct !== undefined
    || p.recycledContent.nickelPct !== undefined
    || p.recycledContent.leadPct !== undefined;
  const hasLifecycleSection =
    p.lifecycle.expectedCycles !== undefined
    || p.lifecycle.repairabilityScore !== undefined
    || p.lifecycle.sparePartsAvailableYears !== undefined
    || p.lifecycle.warrantyYears !== undefined;
  const hasEndOfLifeSection =
    Boolean(p.endOfLife.recyclingInstructions)
    || (p.endOfLife.hazardousSubstances?.length ?? 0) > 0;

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
        <div className="mx-auto max-w-4xl px-6 pb-10 pt-10 sm:px-8">
          <div className="flex flex-col items-center gap-6 text-center md:flex-row md:items-center md:text-left">
            <ProductImageCard imageUrl={productImageUrl} productName={displayProductName} />
            <div className="min-w-0 flex-1">
              <div className="mb-4 flex justify-center md:justify-start">
                <div className="inline-flex flex-wrap items-center justify-center gap-2 md:justify-start">
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
              <div className="mt-4 flex justify-center md:justify-start">
                <ConfidenceBadge score={p.extractionConfidence} />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 px-4 py-8 sm:px-6 sm:space-y-6">

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
            <form action="/api/products/validate" method="post" className="space-y-3">
              <input type="hidden" name="productId" value={p.id} />
              <input type="hidden" name="returnUrl" value={`/p/${p.id}`} />
              <div>
                <label htmlFor="validatedBy" className="block text-xs font-semibold text-amber-950">
                  Auditor / prüfende Person
                </label>
                <input
                  id="validatedBy"
                  name="validatedBy"
                  type="text"
                  autoComplete="name"
                  maxLength={240}
                  className="mt-1.5 w-full max-w-md rounded-lg border border-amber-200/90 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                  placeholder="z. B. Name oder interne Kennung"
                />
                <p className="mt-1 text-[11px] text-amber-800/90">
                  Wird nach Abnahme unter „Allgemeine Informationen“ als Verifizierender angezeigt.
                </p>
              </div>
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
        <Section>
          {manufacturerDisplayBlock ? (
            <Field
              label="Hersteller / Verantwortlicher"
              value={manufacturerDisplayBlock}
              multiline
            />
          ) : null}
          <HumanReviewStatusBar />
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

        {/* ── Technische Spezifikation ── */}
        <Section>
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

        <EnvironmentalFootprintSection raw={raw as Record<string, unknown>} carbonFootprint={p.carbonFootprint} />

        {/* ── DPP Core fields (new extraction schema) ── */}
        <Section title="Entsorgung" subtitle="ESPR · Abfall & Rückbau">
          <Field label="Produktname" value={typeof raw.productName === 'string' ? raw.productName : undefined} />
          <ReviewField
            label="GTIN"
            value={typeof raw.gtin === 'string' ? raw.gtin : undefined}
            highlighted={enrichmentFields.includes('gtin')}
            sourceBadge={ragSuppliedFields.includes('gtin') ? 'RAG' : undefined}
          />
          <Field label="Abfallschluessel (EAK)" value={typeof raw.wasteCode === 'string' ? raw.wasteCode : undefined} />
          {showAvv170106DisposalDetail ? <Avv170106DisposalDetailCard /> : null}
          <HazardCodesField
            label="P-Sätze (Sicherheitshinweise)"
            codes={productLevelPStatements}
            sourceBadge={
              ragSuppliedFields.includes('pStatements') || hazardFromRagAudit('pStatements') ? 'RAG' : undefined
            }
          />
          {renderMaterialZusammensetzungKernfelder(raw.materialComposition, raw.materialZusammensetzung)}
          {renderChemicalComposition(raw.chemicalComposition)}
          {renderRecycledContent(raw.recycledContent)}
          {renderUnifiedHazardousIngredients(raw)}
          {renderSupplierAndProcessInformation(raw.supplierAndProcessInformation)}
          {renderCareRepairDurability(raw.careRepairDurability)}
        </Section>

        <RagProvenanceSection
          ragEnrichment={raw.ragEnrichment}
          attachments={raw.attachments ?? raw.downloadableDocuments ?? raw.sourceDocuments}
        />

        {hasRecycledContentSection ? (
          <Section>
            <Pct label="Kobalt"   value={p.recycledContent.cobaltPct} />
            <Pct label="Lithium"  value={p.recycledContent.lithiumPct} />
            <Pct label="Nickel"   value={p.recycledContent.nickelPct} />
            <Pct label="Blei"     value={p.recycledContent.leadPct} />
          </Section>
        ) : null}

        {hasLifecycleSection ? (
          <Section>
            <Field label="Erwartete Ladezyklen"  value={p.lifecycle.expectedCycles} />
            <Field label="Reparierbarkeitsindex" value={p.lifecycle.repairabilityScore !== undefined ? `${p.lifecycle.repairabilityScore} / 10` : undefined} />
            <Field label="Ersatzteil-Verfügbarkeit" value={p.lifecycle.sparePartsAvailableYears !== undefined ? `${p.lifecycle.sparePartsAvailableYears} Jahre` : undefined} />
            <Field label="Garantie"              value={p.lifecycle.warrantyYears !== undefined ? `${p.lifecycle.warrantyYears} Jahre` : undefined} />
          </Section>
        ) : null}

        {hasEndOfLifeSection ? (
          <Section>
            <Field label="Recyclinganweisungen" value={p.endOfLife.recyclingInstructions} />
            {p.endOfLife.hazardousSubstances?.length ? (
              <Field label="Gefahrstoffe" value={p.endOfLife.hazardousSubstances.join(', ')} />
            ) : null}
          </Section>
        ) : null}

        {(() => {
          const handlingText = pickHandlingInstructionsForDisplay(raw);
          if (!handlingText) return null;
          return (
            <Section>
              <Field
                label="Verarbeitung & Handhabungshinweise"
                value={handlingText}
                multiline
                sourceBadge={isHandlingInstructionsFromRag(raw) ? 'RAG' : undefined}
              />
            </Section>
          );
        })()}

        {/* ── Regulatory ── */}
        <Section>
          <Field label="Zertifizierungsstelle" value={p.certificationBody} />
          <Field label="Rechtsgrundlage"        value={p.regulatoryReference} />
          <Field label="Rechtliche Hinweise"    value={p.legalNotes} />
          <Field label="Lieferkette"            value={p.supplyChainInfo} />
        </Section>

        <ComplianceDocumentsSection attachments={complianceAttachments} />

      </main>

      <footer className="mt-4 border-t border-slate-200/90 bg-[#0c1929] px-6 py-12 text-center text-sm text-slate-400">
        <p className="font-semibold tracking-wide text-slate-300">Digitaler Produktpass</p>
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
