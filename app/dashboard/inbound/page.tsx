'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FileSpreadsheet, FileText, Loader2, RefreshCw, Search, Upload } from 'lucide-react';

import { DraftAuditorPanel } from '@/app/dashboard/inbound/DraftAuditorPanel';
import {
  StagingAuditorPanel,
  type StagingEventRow,
} from '@/app/dashboard/inbound/StagingAuditorPanel';
import { StammdatenFieldsCard } from '@/app/dashboard/inbound/StammdatenFieldsCard';
import {
  STAGING_SOURCE_LABELS,
  STAGING_STATUS_LABELS,
  stagingStatusBadgeClass,
} from '@/app/domain/inbound/stagingDisplay';
import type { InboundGapRecord, InboundValidationReportBundle } from '@/app/domain/inbound/draftAuditDisplay';

const CARD_CLASS =
  'overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_28px_-6px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/[0.04]';

type GapRecord = InboundGapRecord;

type DraftRow = {
  id: string;
  upi: string;
  source: string;
  payload: Record<string, unknown>;
  is_draft: boolean;
  created_at: string;
  match_status?: string;
  master_upi?: string | null;
  matched_by?: string | null;
  validation_status?: 'pending' | 'valid' | 'invalid' | null;
  readiness_score_percent?: number | null;
  validation_report?: InboundValidationReportBundle | null;
  gaps?: GapRecord[] | null;
  validated_at?: string | null;
};

const MATCH_LABELS: Record<string, string> = {
  master: 'Master (Excel)',
  enriched: 'Angereichert',
  unmatched: 'Nicht zugeordnet',
};

const SOURCE_LABELS: Record<string, string> = {
  kmu_excel: 'Excel/CSV',
  pdf_extract: 'PDF',
  enterprise_ingest: 'ERP JSON',
};

function scoreColor(score: number | null | undefined, status?: string | null): string {
  if (status === 'invalid' || (score != null && score < 40)) {
    return 'text-red-700 bg-red-50';
  }
  if (score != null && score >= 80) {
    return 'text-emerald-700 bg-emerald-50';
  }
  if (score != null && score >= 40) {
    return 'text-amber-700 bg-amber-50';
  }
  return 'text-slate-500 bg-slate-100';
}

function validationLabel(status?: string | null): string {
  if (status === 'valid') return 'Gültig';
  if (status === 'invalid') return 'Ungültig';
  if (status === 'pending') return 'Ausstehend';
  return '—';
}

function formatUploadError(body: Record<string, unknown>): string {
  const detail = body.detail;
  if (typeof detail === 'string') {
    return detail;
  }
  if (detail && typeof detail === 'object') {
    const record = detail as {
      message?: string;
      hint?: string;
      found_columns?: string[];
    };
    const parts = [record.message, record.hint];
    if (record.found_columns?.length) {
      parts.push(`Gefundene Spalten: ${record.found_columns.join(', ')}`);
    }
    const text = parts.filter(Boolean).join(' — ');
    if (text) return text;
  }
  if (typeof body.error === 'string') {
    return body.error;
  }
  return `HTTP ${String(body.status ?? 'error')}`;
}

export default function InboundDashboardPage() {
  const [tenantId, setTenantId] = useState('default');
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [excelUploading, setExcelUploading] = useState(false);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [validatingUpi, setValidatingUpi] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<DraftRow | null>(null);
  const [storageHint, setStorageHint] = useState<string | null>(null);
  const [mainView, setMainView] = useState<'passports' | 'staging'>('passports');
  const [stagingRows, setStagingRows] = useState<StagingEventRow[]>([]);
  const [stagingLoading, setStagingLoading] = useState(false);
  const [selectedStaging, setSelectedStaging] = useState<StagingEventRow | null>(null);

  const loadDrafts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/inbound/drafts?tenantId=${encodeURIComponent(tenantId)}`);
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error ?? `HTTP ${response.status}`);
      }
      setRows(body.items ?? []);
      setStorageHint(typeof body.hint === 'string' ? body.hint : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Laden fehlgeschlagen');
      setRows([]);
      setStorageHint(null);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  const loadStaging = useCallback(async () => {
    setStagingLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/inbound/staging/events?tenantId=${encodeURIComponent(tenantId)}`,
      );
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error ?? `HTTP ${response.status}`);
      }
      setStagingRows((body.items ?? []) as StagingEventRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Staging laden fehlgeschlagen');
      setStagingRows([]);
    } finally {
      setStagingLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadDrafts();
    void loadStaging();
  }, [loadDrafts, loadStaging]);

  async function revalidate(upi: string) {
    setValidatingUpi(upi);
    setError(null);
    try {
      const response = await fetch('/api/inbound/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, upi }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.detail ?? body.error ?? `HTTP ${response.status}`);
      }
      setLastMessage(
        `Validierung ${upi}: ${body.readiness_score_percent?.toFixed?.(1) ?? body.readiness_score_percent}% — ${body.gap_count} Lücken.`,
      );
      if (selectedRow?.upi === upi && body.stored) {
        setSelectedRow(body.stored as DraftRow);
      }
      await loadDrafts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validierung fehlgeschlagen');
    } finally {
      setValidatingUpi(null);
    }
  }

  async function manualMatch(enrichmentUpi: string, masterUpi: string) {
    setError(null);
    try {
      const response = await fetch('/api/inbound/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          enrichment_upi: enrichmentUpi,
          master_upi: masterUpi,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.detail ?? body.error ?? `HTTP ${response.status}`);
      }
      setLastMessage(`PDF ${enrichmentUpi} → Produkt ${masterUpi} zugeordnet.`);
      await loadDrafts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Zuordnung fehlgeschlagen');
    }
  }

  const masterUpis = rows
    .filter((row) => row.match_status === 'master' || row.match_status === 'enriched')
    .map((row) => row.upi);

  async function uploadFile(endpoint: string, file: File, setBusy: (v: boolean) => void) {
    setBusy(true);
    setLastMessage(null);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('tenantId', tenantId);
      const response = await fetch(endpoint, { method: 'POST', body: form });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(formatUploadError(body as Record<string, unknown>));
      }
      const count = body.count ?? 1;
      const pdfCategory =
        typeof (body as { extraction?: { product_category?: string } }).extraction?.product_category ===
        'string'
          ? (body as { extraction: { product_category: string } }).extraction.product_category
          : null;
      const categoryHint = pdfCategory ? ` — Kategorie ${pdfCategory}` : '';
      const matchInfo = body.match_status === 'enriched'
        ? ` → Produkt ${body.matched_master_upi} (${body.matched_by})`
        : body.match_status === 'unmatched'
          ? ' (kein Match — manuell zuordnen)'
          : '';
      const items = Array.isArray(body.items) ? body.items as Array<Record<string, unknown>> : [];
      const scores = items
        .map((item) => item.readiness_score_percent)
        .filter((value): value is number => typeof value === 'number');
      const scoreHint =
        scores.length > 0
          ? ` — ESPR-Score Ø ${(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)}%`
          : '';
      setLastMessage(
        `${count} Datensatz${count === 1 ? '' : 'e'} importiert${categoryHint}${matchInfo}${scoreHint}.`,
      );
      await loadDrafts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#eef1f8] pb-12">
      <nav className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/90 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0c1929] text-[11px] font-bold text-white">
              DPP
            </span>
            <span className="text-sm font-bold text-[#0c1929]">
              flash <span className="font-normal text-slate-400">· Inbound</span>
            </span>
          </div>
          <div className="flex gap-3 text-xs font-medium">
            <Link href="/dashboard/create" className="text-sky-700 underline decoration-sky-200 underline-offset-2">
              PDF Wizard
            </Link>
            <Link href="/dashboard/sap-simulation" className="text-sky-700 underline decoration-sky-200 underline-offset-2">
              SAP Simulation
            </Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-5xl space-y-6 px-4 pt-8 sm:px-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0c1929]">Inbound Funnel</h1>
          <p className="mt-1 text-sm text-slate-500">
            Excel/CSV und PDF importieren — Daten landen in Supabase (<code className="text-xs">product_passports</code>).
          </p>
        </div>

        <div className={`${CARD_CLASS} p-5`}>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tenant ID</label>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <input
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="default"
            />
            <button
              type="button"
              onClick={() => {
                void loadDrafts();
                void loadStaging();
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" />
              Aktualisieren
            </button>
            <div className="flex rounded-lg border border-slate-200 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setMainView('passports')}
                className={`rounded-md px-3 py-1.5 ${mainView === 'passports' ? 'bg-[#0c1929] text-white' : 'text-slate-600'}`}
              >
                Passports
              </button>
              <button
                type="button"
                onClick={() => setMainView('staging')}
                className={`rounded-md px-3 py-1.5 ${mainView === 'staging' ? 'bg-[#0c1929] text-white' : 'text-slate-600'}`}
              >
                Staging
              </button>
            </div>
          </div>
        </div>

        <StammdatenFieldsCard tenantId={tenantId} />

        <div className="grid gap-4 md:grid-cols-2">
          <div className={`${CARD_CLASS} p-5`}>
            <div className="mb-3 flex items-center gap-2 text-[#0c1929]">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
              <h2 className="font-semibold">KMU Excel / CSV</h2>
            </div>
            <p className="mb-4 text-xs text-slate-500">
              Produkt-ID-Spalte: SKU, Produkt ID, Artikelnummer, MATNR, Material-Nr., Product ID, …
            </p>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-sm text-slate-600 hover:border-sky-300 hover:bg-sky-50/50">
              {excelUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {excelUploading ? 'Import läuft…' : 'Excel oder CSV wählen'}
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                disabled={excelUploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadFile('/api/inbound/kmu-upload', file, setExcelUploading);
                  e.target.value = '';
                }}
              />
            </label>
          </div>

          <div className={`${CARD_CLASS} p-5`}>
            <div className="mb-3 flex items-center gap-2 text-[#0c1929]">
              <FileText className="h-5 w-5 text-sky-600" />
              <h2 className="font-semibold">PDF → JSON</h2>
            </div>
            <p className="mb-4 text-xs text-slate-500">
              Zuerst Excel importieren (Master). PDF wird per UPI/GTIN automatisch dem Produkt zugeordnet.
            </p>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-sm text-slate-600 hover:border-sky-300 hover:bg-sky-50/50">
              {pdfUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {pdfUploading ? 'Extraktion läuft…' : 'PDF wählen'}
              <input
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                disabled={pdfUploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadFile('/api/inbound/pdf-extract', file, setPdfUploading);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </div>

        {lastMessage && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {lastMessage}
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}
        {storageHint && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {storageHint}
          </div>
        )}

        {mainView === 'staging' ? (
        <div className={`${CARD_CLASS} overflow-x-auto`}>
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold text-[#0c1929]">Staging-Warteschlange ({stagingRows.length})</h2>
            <p className="mt-1 text-xs text-slate-500">
              Webhook/CSV-Ingest → Triage → Auto-Merge. Konflikte und Waisen im Staging-Auditor bearbeiten.
            </p>
          </div>
          {stagingLoading ? (
            <div className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Lade Staging-Events…
            </div>
          ) : stagingRows.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-slate-500">
              Keine Staging-Events — nutze{' '}
              <code className="text-xs">/api/inbound/ingest/webhook</code> oder File-Ingest.
            </p>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">UPI</th>
                  <th className="px-5 py-3">Quelle</th>
                  <th className="px-5 py-3">Fehler</th>
                  <th className="px-5 py-3">Auditor</th>
                  <th className="px-5 py-3">Erstellt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stagingRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${stagingStatusBadgeClass(row.status)}`}>
                        {STAGING_STATUS_LABELS[row.status as keyof typeof STAGING_STATUS_LABELS] ?? row.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-medium">{row.extracted_upi ?? row.merged_upi ?? '—'}</td>
                    <td className="px-5 py-3 text-xs">{STAGING_SOURCE_LABELS[row.source] ?? row.source}</td>
                    <td className="max-w-[12rem] truncate px-5 py-3 text-xs text-red-700" title={row.merge_error ?? ''}>
                      {row.merge_error ?? '—'}
                    </td>
                    <td className="px-5 py-3">
                      <button
                        type="button"
                        onClick={() => setSelectedStaging(row)}
                        className="text-xs font-medium text-sky-700 underline decoration-sky-200"
                      >
                        Auditor
                      </button>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {new Date(row.created_at).toLocaleString('de-DE')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        ) : null}

        {mainView === 'passports' ? (
        <div className={`${CARD_CLASS} overflow-x-auto`}>
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold text-[#0c1929]">Gespeicherte Drafts ({rows.length})</h2>
            <p className="mt-1 text-xs text-slate-500">
              Klick auf UPI, Score oder <span className="font-medium text-sky-700">Auditor</span> öffnet die Detailansicht mit Audit-Trail.
            </p>
          </div>
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Lade aus Supabase…
            </div>
          ) : rows.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-slate-500">
              Noch keine Daten — Excel oder PDF hochladen.
            </p>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">UPI</th>
                  <th className="px-5 py-3">Quelle</th>
                  <th className="px-5 py-3">Match</th>
                  <th className="px-5 py-3">Score</th>
                  <th className="px-5 py-3">Validation</th>
                  <th className="px-5 py-3">Auditor</th>
                  <th className="px-5 py-3">GTIN</th>
                  <th className="px-5 py-3">Gewicht</th>
                  <th className="px-5 py-3">Hersteller</th>
                  <th className="px-5 py-3">Aktion</th>
                  <th className="px-5 py-3">Erstellt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => {
                  const payload = row.payload ?? {};
                  const score = row.readiness_score_percent;
                  const gaps = Array.isArray(row.gaps) ? row.gaps : [];
                  return (
                    <Fragment key={row.id}>
                    <tr className="hover:bg-slate-50/80">
                      <td className="px-5 py-3 font-medium text-[#0c1929]">
                        <button
                          type="button"
                          className="text-left underline decoration-slate-300 underline-offset-2 hover:text-sky-700"
                          onClick={() => setSelectedRow(row)}
                        >
                          {row.upi}
                        </button>
                      </td>
                      <td className="px-5 py-3">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                          {SOURCE_LABELS[row.source] ?? row.source}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            row.match_status === 'unmatched'
                              ? 'bg-amber-100 text-amber-800'
                              : row.match_status === 'enriched'
                                ? 'bg-sky-100 text-sky-800'
                                : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {MATCH_LABELS[row.match_status ?? 'master'] ?? row.match_status}
                          {row.matched_by ? ` (${row.matched_by})` : ''}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${scoreColor(score, row.validation_status)}`}
                          onClick={() => setSelectedRow(row)}
                          title="ESPR-Auditor öffnen"
                        >
                          {score != null ? `${Number(score).toFixed(1)}%` : '—'}
                          {gaps.length > 0 ? ` (${gaps.length})` : ''}
                        </button>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            row.validation_status === 'valid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : row.validation_status === 'invalid'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {validationLabel(row.validation_status)}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() => setSelectedRow(row)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 underline decoration-sky-200 underline-offset-2 hover:text-sky-900"
                        >
                          <Search className="h-3.5 w-3.5" />
                          Auditor
                        </button>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{String(payload.gtin ?? '—')}</td>
                      <td className="px-5 py-3 text-slate-600">{String(payload.weight ?? '—')}</td>
                      <td className="max-w-[10rem] truncate px-5 py-3 text-slate-600" title={String(payload.hersteller ?? payload.manufacturer_address ?? '')}>
                        {String(payload.hersteller ?? '—')}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            disabled={validatingUpi === row.upi}
                            onClick={() => void revalidate(row.upi)}
                            className="rounded border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
                          >
                            {validatingUpi === row.upi ? '…' : 'Validieren'}
                          </button>
                          {row.match_status === 'unmatched' && masterUpis.length > 0 ? (
                            <select
                              className="rounded border border-slate-200 px-2 py-1 text-xs"
                              defaultValue=""
                              onChange={(e) => {
                                const masterUpi = e.target.value;
                                if (masterUpi) void manualMatch(row.upi, masterUpi);
                                e.target.value = '';
                              }}
                            >
                              <option value="">Produkt wählen…</option>
                              {masterUpis.map((upi) => (
                                <option key={upi} value={upi}>{upi}</option>
                              ))}
                            </select>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500">
                        {new Date(row.created_at).toLocaleString('de-DE')}
                      </td>
                    </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        ) : null}
      </div>

      {selectedStaging ? (
        <StagingAuditorPanel
          tenantId={tenantId}
          event={selectedStaging}
          onClose={() => setSelectedStaging(null)}
          onUpdated={() => {
            void loadStaging();
            void loadDrafts();
          }}
        />
      ) : null}

      {selectedRow ? (
        <DraftAuditorPanel
          upi={selectedRow.upi}
          source={SOURCE_LABELS[selectedRow.source] ?? selectedRow.source}
          payload={selectedRow.payload ?? {}}
          validationStatus={selectedRow.validation_status}
          readinessScore={selectedRow.readiness_score_percent}
          validatedAt={selectedRow.validated_at}
          validationReport={selectedRow.validation_report}
          gaps={selectedRow.gaps}
          validating={validatingUpi === selectedRow.upi}
          onClose={() => setSelectedRow(null)}
          onRevalidate={() => void revalidate(selectedRow.upi)}
        />
      ) : null}
    </div>
  );
}
