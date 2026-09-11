'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, CircleAlert, Loader2, X } from 'lucide-react';

import {
  auditStatusLabel,
  blockLabel,
  buildDraftAuditRows,
  groupAuditRowsByBlock,
  type DraftAuditFieldRow,
  type InboundGapRecord,
  type InboundValidationReportBundle,
  sourceSystemLabel,
} from '@/app/domain/inbound/draftAuditDisplay';
import { DraftStammdatenSection } from '@/app/dashboard/inbound/DraftStammdatenSection';
import { PRODUCT_CATEGORY_LABELS } from '@/app/domain/inbound/stagingDisplay';

type DraftAuditorPanelProps = {
  upi: string;
  source: string;
  payload: Record<string, unknown>;
  validationStatus?: string | null;
  readinessScore?: number | null;
  validatedAt?: string | null;
  validationReport?: InboundValidationReportBundle | null;
  gaps?: InboundGapRecord[] | null;
  validating: boolean;
  onClose: () => void;
  onRevalidate: () => void;
};

type FilterMode = 'all' | 'filled' | 'missing';

function statusDotClass(status: DraftAuditFieldRow['status']): string {
  switch (status) {
    case 'missing':
      return 'bg-red-400';
    case 'erp':
      return 'bg-sky-500';
    case 'pdf':
      return 'bg-violet-500';
    case 'inference':
      return 'bg-amber-500';
    default:
      return 'bg-emerald-500';
  }
}

function statusBadgeClass(status: DraftAuditFieldRow['status']): string {
  switch (status) {
    case 'missing':
      return 'bg-red-50 text-red-800 ring-red-200';
    case 'erp':
      return 'bg-sky-50 text-sky-800 ring-sky-200';
    case 'pdf':
      return 'bg-violet-50 text-violet-800 ring-violet-200';
    case 'inference':
      return 'bg-amber-50 text-amber-900 ring-amber-200';
    default:
      return 'bg-emerald-50 text-emerald-800 ring-emerald-200';
  }
}

export function DraftAuditorPanel({
  upi,
  source,
  payload,
  validationStatus,
  readinessScore,
  validatedAt,
  validationReport,
  gaps,
  validating,
  onClose,
  onRevalidate,
}: DraftAuditorPanelProps) {
  const [filter, setFilter] = useState<FilterMode>('all');

  const gapList = Array.isArray(gaps) ? gaps : [];
  const rows = useMemo(
    () => buildDraftAuditRows(validationReport ?? null, gapList),
    [validationReport, gapList],
  );
  const filteredRows = useMemo(() => {
    if (filter === 'filled') {
      return rows.filter((row) => row.status !== 'missing');
    }
    if (filter === 'missing') {
      return rows.filter((row) => row.status === 'missing');
    }
    return rows;
  }, [filter, rows]);
  const grouped = useMemo(() => groupAuditRowsByBlock(filteredRows), [filteredRows]);

  const filledCount = rows.filter((row) => row.status !== 'missing').length;
  const missingCount = rows.filter((row) => row.status === 'missing').length;
  const totalFields = validationReport?.total_field_paths ?? rows.length;
  const hasSnapshot = Boolean(validationReport?.analysis_snapshot);
  const productCategoryRaw =
    validationReport?.analysis_snapshot &&
    typeof validationReport.analysis_snapshot === 'object' &&
    'product_category' in validationReport.analysis_snapshot
      ? String((validationReport.analysis_snapshot as { product_category?: string }).product_category ?? '')
      : '';
  const productCategoryLabel =
    productCategoryRaw && PRODUCT_CATEGORY_LABELS[productCategoryRaw]
      ? PRODUCT_CATEGORY_LABELS[productCategoryRaw]
      : productCategoryRaw || null;

  const plausibility = validationReport?.plausibility;
  const plausibilityFindings = plausibility?.findings ?? [];
  const showPlausibility =
    plausibilityFindings.length > 0 &&
    (plausibility?.passed === false ||
      plausibilityFindings.some((f) => f.severity === 'warning'));

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
        aria-label="Auditor schließen"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        <header className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">ESPR Auditor</p>
              <h2 className="mt-1 text-lg font-bold text-[#0c1929]">{upi}</h2>
              <p className="mt-1 text-xs text-slate-500">Quelle: {source}</p>
              {productCategoryLabel ? (
                <p className="mt-1 text-xs text-slate-600">
                  Produktkategorie: <span className="font-medium">{productCategoryLabel}</span>
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
              Score {readinessScore != null ? `${Number(readinessScore).toFixed(1)}%` : '—'}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
              {filledCount} / {totalFields} Felder
            </span>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                validationStatus === 'valid'
                  ? 'bg-emerald-100 text-emerald-800'
                  : validationStatus === 'invalid'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-slate-100 text-slate-600'
              }`}
            >
              {validationStatus ?? 'pending'}
            </span>
            {validatedAt ? (
              <span className="text-xs text-slate-400">
                {new Date(validatedAt).toLocaleString('de-DE')}
              </span>
            ) : null}
          </div>

          {!hasSnapshot ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Kein Audit-Snapshot — bitte „Validieren“ klicken, um Felder mit Provenance zu laden.
            </div>
          ) : null}

          {validationReport?.audit?.co2_mapping_applied ? (
            <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
              CO₂-Proxy angewendet: {validationReport.audit.co2_notes ?? 'Platzhalter-LCA'}
            </div>
          ) : null}

          {showPlausibility ? (
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs font-semibold text-slate-700">
                Plausibilität
                {plausibility?.passed === false ? (
                  <span className="ml-2 font-normal text-red-700">— Prüfung fehlgeschlagen</span>
                ) : (
                  <span className="ml-2 font-normal text-amber-800">— Hinweise</span>
                )}
              </p>
              <ul className="mt-2 space-y-1.5">
                {plausibilityFindings.map((finding, index) => (
                  <li key={`${finding.rule_id}-${index}`} className="flex items-start gap-1.5 text-xs">
                    <CircleAlert
                      className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                        finding.severity === 'critical' || finding.severity === 'major'
                          ? 'text-red-600'
                          : 'text-amber-600'
                      }`}
                    />
                    <span className="text-slate-700">
                      <span className="font-medium text-slate-500">{finding.field_path}</span>
                      {' — '}
                      {finding.message}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            {(['all', 'filled', 'missing'] as FilterMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setFilter(mode)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  filter === mode
                    ? 'bg-[#0c1929] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {mode === 'all' ? `Alle (${rows.length})` : null}
                {mode === 'filled' ? `Validiert (${filledCount})` : null}
                {mode === 'missing' ? `Offen (${missingCount})` : null}
              </button>
            ))}
            <button
              type="button"
              disabled={validating}
              onClick={onRevalidate}
              className="ml-auto rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              {validating ? <Loader2 className="inline h-3 w-3 animate-spin" /> : 'Neu validieren'}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <DraftStammdatenSection payload={payload} />

          <h3 className="mb-3 text-sm font-semibold text-[#0c1929]">ESPR-Felder (Validator)</h3>
          {[...grouped.entries()].map(([block, blockRows]) => (
            <section key={block} className="mb-6">
              <h3 className="mb-2 text-sm font-semibold text-[#0c1929]">{blockLabel(block)}</h3>
              <ul className="space-y-2">
                {blockRows.map((row) => (
                  <li
                    key={row.path}
                    className="rounded-xl border border-slate-200/80 bg-slate-50/50 px-3 py-3"
                  >
                    <div className="flex items-start gap-2">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${statusDotClass(row.status)}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-slate-800">{row.label}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${statusBadgeClass(row.status)}`}>
                            {auditStatusLabel(row.status)}
                          </span>
                        </div>
                        <p className="mt-1 font-mono text-[10px] text-slate-400">{row.path}</p>
                        <p className="mt-2 text-sm text-slate-700">
                          {row.value ?? <span className="italic text-slate-400">— leer —</span>}
                        </p>
                        {row.status !== 'missing' ? (
                          <div className="mt-2 space-y-1 text-xs text-slate-500">
                            <p>
                              <span className="font-medium text-slate-600">Quelle:</span>{' '}
                              {sourceSystemLabel(row.source_system)}
                            </p>
                            {row.source_detail ? (
                              <p>
                                <span className="font-medium text-slate-600">Audit-Trail:</span>{' '}
                                {row.source_detail}
                              </p>
                            ) : null}
                            {row.timestamp ? (
                              <p>
                                <span className="font-medium text-slate-600">Zeitstempel:</span>{' '}
                                {new Date(row.timestamp).toLocaleString('de-DE')}
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <p className="mt-2 flex items-start gap-1 text-xs text-red-700">
                            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            {row.gap_reason ?? 'Pflichtfeld fehlt.'}
                          </p>
                        )}
                      </div>
                      {row.status !== 'missing' ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {filteredRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Keine Felder in diesem Filter.</p>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
