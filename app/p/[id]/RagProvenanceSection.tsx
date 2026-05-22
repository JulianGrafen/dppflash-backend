'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AuditedValue } from '@/app/domain/rag/auditTrailSchema';
import {
  matchComplianceDocumentByFileName,
  parseComplianceSourceDocuments,
  type ComplianceSourceDocument,
} from '@/app/domain/rag/sourceDocuments';
import { ChevronDown, ExternalLink, FileSearch, FileText } from 'lucide-react';

type ActiveAuditSource = {
  readonly pdfName: string;
  readonly pdfUrl: string | null;
  readonly pageNumber: number;
  readonly contextSnippet: string;
  readonly fieldName: string;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isAuditedValue(v: unknown): v is AuditedValue {
  if (!isRecord(v)) return false;
  return (
    'value' in v
    && 'confidence' in v
    && 'source' in v
    && 'requiresManualReview' in v
    && isRecord(v.source)
    && typeof v.source.fileName === 'string'
    && typeof v.source.contextSnippet === 'string'
    && (typeof v.source.pageNumber === 'number' || typeof v.source.pageNumber === 'string')
  );
}

function pickDisplayName(value: Record<string, unknown>): string | undefined {
  for (const key of ['stoffname', 'name', 'material', 'substance', 'component', 'title'] as const) {
    const candidate = value[key];
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return undefined;
}

function formatStructuredValue(value: unknown): string {
  if (value === null) {
    return '— (null)';
  }
  if (Array.isArray(value)) {
    const items = value.flatMap((item) => {
      if (item === null || item === undefined) {
        return [];
      }
      if (typeof item === 'string' || typeof item === 'number') {
        return [String(item)];
      }
      if (isRecord(item)) {
        return [pickDisplayName(item) ?? JSON.stringify(item)];
      }
      return [String(item)];
    });
    return items.length > 0 ? items.join(', ') : '—';
  }
  if (isRecord(value)) {
    return pickDisplayName(value) ?? JSON.stringify(value);
  }
  return String(value);
}

/** **Extrahiert** eine Seitennummer aus Zahl oder Text wie „Seite 1“. */
export function parsePageNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 1) {
    return Math.floor(value);
  }
  if (typeof value === 'string') {
    const match = value.match(/(?:seite\s*)?(\d+)/i);
    if (match) {
      return Math.max(1, parseInt(match[1], 10));
    }
  }
  return 1;
}

/**
 * Hängt den Seiten-Anker an die PDF-URL (`#page=N`), damit moderne PDF-Viewer direkt
 * zur belegenden Seite springen — ohne den eigentlichen Storage-Link zu manipulieren.
 */
function buildPdfPageUrl(url: string, pageNumber: number): string {
  if (!url) {
    return url;
  }
  const cleanPage = Number.isFinite(pageNumber) && pageNumber >= 1 ? Math.floor(pageNumber) : 1;
  return url.includes('#') ? url : `${url}#page=${cleanPage}`;
}

function resolveSourceUrl(
  entry: AuditedValue,
  docs: readonly ComplianceSourceDocument[],
  fieldName?: string,
): string | undefined {
  const source = entry.source as Record<string, unknown>;
  const directUrl =
    typeof source.url === 'string' && source.url.trim()
      ? source.url.trim()
      : typeof source.publicUrl === 'string' && source.publicUrl.trim()
        ? source.publicUrl.trim()
        : undefined;
  if (directUrl) {
    return directUrl;
  }

  return matchComplianceDocumentByFileName(entry.source.fileName, docs, { fieldName })?.url;
}

function buildAuditSourceFromRow(
  key: string,
  entry: AuditedValue,
  complianceDocs: readonly ComplianceSourceDocument[],
): ActiveAuditSource {
  const pageNumber = parsePageNumber(entry.source.pageNumber);
  const rawUrl = resolveSourceUrl(entry, complianceDocs, key);
  const pdfUrl = rawUrl ? buildPdfPageUrl(rawUrl, pageNumber) : null;

  return {
    pdfName: entry.source.fileName,
    pdfUrl,
    pageNumber,
    contextSnippet: entry.source.contextSnippet,
    fieldName: key,
  };
}

function pickDefaultAuditSource(
  rows: readonly { readonly key: string; readonly entry: AuditedValue }[],
  complianceDocs: readonly ComplianceSourceDocument[],
): ActiveAuditSource | null {
  if (rows.length === 0) {
    return null;
  }
  const herstellerRow = rows.find(({ key }) => key === 'hersteller');
  const pick = herstellerRow ?? rows[0];
  return buildAuditSourceFromRow(pick.key, pick.entry, complianceDocs);
}

export function RagProvenanceSection({
  ragEnrichment,
  attachments,
}: {
  readonly ragEnrichment: unknown;
  readonly attachments?: unknown;
}) {
  const { rows, applied, cryptoOk, cryptoErrors, complianceDocs } = useMemo(() => {
    if (!isRecord(ragEnrichment) || ragEnrichment.success !== true) {
      return {
        rows: [] as { readonly key: string; readonly entry: AuditedValue }[],
        applied: [] as string[],
        cryptoOk: false,
        cryptoErrors: [] as string[],
        complianceDocs: [] as ComplianceSourceDocument[],
      };
    }

    const trail = isRecord(ragEnrichment.auditTrail) ? ragEnrichment.auditTrail : {};
    const appliedFieldKeys = Array.isArray(ragEnrichment.appliedFieldKeys)
      ? (ragEnrichment.appliedFieldKeys as string[])
      : [];
    const crypto = isRecord(ragEnrichment.cryptoValidation)
      ? ragEnrichment.cryptoValidation
      : undefined;
    const cryptoValidationOk = crypto?.ok === true;
    const validationErrors = Array.isArray(crypto?.errors) ? (crypto.errors as string[]) : [];

    const auditRows: { readonly key: string; readonly entry: AuditedValue }[] = [];
    if (trail.gtin && isAuditedValue(trail.gtin)) {
      auditRows.push({ key: 'gtin', entry: trail.gtin });
    }
    if (trail.ewcCode && isAuditedValue(trail.ewcCode)) {
      auditRows.push({ key: 'ewcCode', entry: trail.ewcCode });
    }
    if (trail.fields && isRecord(trail.fields)) {
      for (const [key, val] of Object.entries(trail.fields)) {
        if (isAuditedValue(val)) {
          auditRows.push({ key, entry: val });
        }
      }
    }

    return {
      rows: auditRows,
      applied: appliedFieldKeys,
      cryptoOk: cryptoValidationOk,
      cryptoErrors: validationErrors,
      complianceDocs: parseComplianceSourceDocuments(attachments),
    };
  }, [ragEnrichment, attachments]);

  const defaultAuditSource = useMemo(
    () => pickDefaultAuditSource(rows, complianceDocs),
    [rows, complianceDocs],
  );

  const [activeAuditSource, setActiveAuditSource] = useState<ActiveAuditSource | null>(defaultAuditSource);

  useEffect(() => {
    if (!defaultAuditSource) {
      setActiveAuditSource(null);
      return;
    }
    setActiveAuditSource((prev) => {
      if (prev && rows.some(({ key }) => key === prev.fieldName)) {
        return prev;
      }
      return defaultAuditSource;
    });
  }, [defaultAuditSource, rows]);

  if (!isRecord(ragEnrichment)) {
    return null;
  }

  if (ragEnrichment.success === false) {
    const msg = typeof ragEnrichment.message === 'string' ? ragEnrichment.message : 'RAG-Anreicherung fehlgeschlagen.';
    return (
      <section className="overflow-hidden rounded-2xl border border-amber-200/80 bg-white shadow-[0_4px_28px_-6px_rgba(15,23,42,0.12)] ring-1 ring-amber-900/[0.06]">
        <div className="flex items-center gap-3 bg-[#0c1929] px-5 py-4 text-white">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10">
            <FileSearch className="h-5 w-5 text-amber-300" strokeWidth={1.75} aria-hidden />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">RAG / Forensik</h2>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Fehler</p>
          </div>
        </div>
        <div className="px-5 py-4 text-sm text-amber-950">{msg}</div>
      </section>
    );
  }

  if (ragEnrichment.success !== true) {
    return null;
  }

  return (
    <details className="group overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_28px_-6px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/[0.04]">
      <summary className="flex cursor-pointer list-none items-center gap-3 bg-[#0c1929] px-5 py-4 text-white marker:hidden">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10">
          <FileSearch className="h-5 w-5 text-sky-300" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold tracking-tight">RAG — Quellen & Belege</h2>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Indizierter Dokumentabgleich
          </p>
        </div>
        <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
          <span className="hidden sm:inline">Details</span>
          <ChevronDown
            className="h-4 w-4 transition-transform group-open:rotate-180"
            strokeWidth={2}
            aria-hidden
          />
        </span>
      </summary>
      <div className="space-y-3 border-b border-slate-100 bg-slate-50/50 px-5 py-4 text-[13px]">
        <p className="text-slate-700">
          <span className="font-semibold text-slate-900">Übernommene Felder:</span>{' '}
          {applied.length > 0
            ? applied.join(', ')
            : cryptoOk
              ? 'keine (RAG lieferte nichts Übernehmbares, alle Werte null / bereits befüllt, oder keine passenden Chunks).'
              : 'keine — alle vorgeschlagenen Werte scheiterten an der Krypto-/Formatprüfung (siehe unten).'}
        </p>
        {!cryptoOk && cryptoErrors.length > 0 ? (
          <div className="rounded-xl border border-amber-200/90 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            <p className="mb-1 font-semibold">Krypto-/Formatprüfung</p>
            {applied.length > 0 ? (
              <p className="mb-2 text-amber-950/90">
                Hinweis: Felder, die die Prüfung bestanden haben, sind trotzdem ins Pass übernommen worden.
              </p>
            ) : null}
            <ul className="list-inside list-disc space-y-0.5">
              {cryptoErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <div className="px-5 py-4 text-[13px] text-slate-500">
          Keine auditierten RAG-Felder im Trail (Modell hat vermutlich null geliefert oder nichts extrahiert).
        </div>
      ) : (
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)] lg:items-start">
          <ul className="divide-y divide-slate-100">
            {rows.map(({ key, entry }) => {
              const isActive = activeAuditSource?.fieldName === key;
              const sourceUrl = resolveSourceUrl(entry, complianceDocs, key);
              const pageNumber = parsePageNumber(entry.source.pageNumber);
              const pdfPageUrl = sourceUrl ? buildPdfPageUrl(sourceUrl, pageNumber) : undefined;

              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => setActiveAuditSource(buildAuditSourceFromRow(key, entry, complianceDocs))}
                    className={[
                      'w-full space-y-2 border-l-2 px-5 py-4 text-left transition-all duration-200',
                      'cursor-pointer hover:bg-slate-50',
                      isActive
                        ? 'border-blue-600 bg-blue-50/30'
                        : 'border-transparent',
                    ].join(' ')}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="rounded-md bg-sky-50 px-2 py-0.5 font-mono text-[11px] font-bold text-sky-900 ring-1 ring-sky-200/80">
                        {key}
                      </span>
                      <span className="text-xs font-medium text-slate-500">
                        Konfidenz {(entry.confidence * 100).toFixed(0)} %
                        {entry.requiresManualReview ? ' · manuelle Prüfung' : ''}
                      </span>
                    </div>
                    <p className="break-words text-[13px] font-semibold text-slate-900">
                      {formatStructuredValue(entry.value)}
                    </p>
                    <dl className="grid gap-1 text-xs text-slate-600">
                      <div>
                        <dt className="inline text-slate-500">Quelle:</dt>{' '}
                        <dd className="inline font-medium text-slate-800">
                          {pdfPageUrl ? (
                            <a
                              href={pdfPageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(event) => event.stopPropagation()}
                              className="underline decoration-slate-300 underline-offset-2 hover:text-sky-700"
                            >
                              {entry.source.fileName}
                            </a>
                          ) : (
                            entry.source.fileName
                          )}
                        </dd>
                        <span className="text-slate-400"> · </span>
                        <dd className="inline">Seite {pageNumber}</dd>
                      </div>
                      <div>
                        <dt className="mb-0.5 text-slate-500">Kontext (Chunk-Auszug)</dt>
                        <dd className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-slate-100 bg-slate-50 p-2 font-mono text-[11px] leading-relaxed text-slate-800">
                          {entry.source.contextSnippet}
                        </dd>
                      </div>
                    </dl>
                  </button>
                </li>
              );
            })}
          </ul>

          {activeAuditSource ? (
            <aside className="border-t border-slate-200/80 bg-slate-50/40 lg:sticky lg:top-4 lg:border-l lg:border-t-0">
              <ActiveAuditPdfPreview source={activeAuditSource} />
            </aside>
          ) : null}
        </div>
      )}
      {complianceDocs.length > 0 ? (
        <div className="border-t border-slate-200/80 bg-white">
          <div className="px-5 py-3">
            <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-slate-700">
              Compliance-Dokumente (PDF-Vorschau)
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              Alle indizierten Nachweis-PDFs — inkl. Sicherheitsdatenblatt und Merkblätter. Klicken Sie oben ein
              Quellenfeld, um die Vorschau zu synchronisieren.
            </p>
          </div>
          <ul className="divide-y divide-slate-100">
            {complianceDocs.map((doc) => (
              <li key={doc.url} className="px-5 py-3">
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-[13px] font-semibold text-sky-800 underline decoration-sky-200 underline-offset-2 hover:text-sky-950"
                >
                  <FileText className="h-4 w-4 shrink-0 text-red-700" strokeWidth={1.75} aria-hidden />
                  {doc.title}
                  <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </details>
  );
}

/**
 * **Synchronisierte** Mini-PDF-Vorschau: reagiert auf `activeAuditSource` und zeigt den
 * KI-Kontextausschnitt prominent über dem Iframe.
 */
function ActiveAuditPdfPreview({ source }: { readonly source: ActiveAuditSource }) {
  const iframeSrc = source.pdfUrl ?? undefined;

  return (
    <div className="overflow-hidden p-4">
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50/80 px-3 py-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-700 ring-1 ring-red-100">
            <FileText className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-slate-900" title={source.pdfName}>
              {source.pdfName}
            </p>
            <p className="text-[11px] text-slate-500">
              Feld <span className="font-mono font-semibold">{source.fieldName}</span> · Seite {source.pageNumber}
            </p>
          </div>
          {iframeSrc ? (
            <a
              href={iframeSrc}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-[#0c1929] px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-slate-800"
            >
              Original-PDF auf Seite {source.pageNumber} öffnen
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            </a>
          ) : null}
        </div>

        <div className="border-b border-amber-100 bg-amber-50/70 px-3 py-3">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-amber-900">
            KI-Hervorhebung (Seite {source.pageNumber}):
          </p>
          <p className="rounded border border-amber-200 bg-amber-50 p-3 text-xs italic leading-relaxed text-amber-900 shadow-inner font-mono whitespace-pre-wrap break-words">
            {source.contextSnippet}
          </p>
        </div>

        {iframeSrc ? (
          <iframe
            key={`${source.fieldName}-${iframeSrc}`}
            src={iframeSrc}
            title={`PDF-Vorschau: ${source.pdfName}, Seite ${source.pageNumber}`}
            className="block h-56 w-full bg-slate-100"
          />
        ) : (
          <div className="flex h-40 flex-col items-center justify-center gap-2 bg-slate-50 px-4 text-center">
            <FileSearch className="h-8 w-8 text-slate-400" strokeWidth={1.5} aria-hidden />
            <p className="text-[12px] font-medium text-slate-600">Keine PDF-Vorschau für dieses Feld verfügbar</p>
            <p className="text-[11px] text-slate-500">Quelldatei konnte keinem Compliance-Dokument zugeordnet werden.</p>
          </div>
        )}
      </div>
    </div>
  );
}
