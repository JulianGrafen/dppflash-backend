'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';

import { DraftStammdatenSection } from '@/app/dashboard/inbound/DraftStammdatenSection';
import {
  buildDraftAuditRows,
  groupAuditRowsByBlock,
  type InboundGapRecord,
  type InboundValidationReportBundle,
} from '@/app/domain/inbound/draftAuditDisplay';
import {
  STAGING_SOURCE_LABELS,
  STAGING_STATUS_LABELS,
  stagingStatusBadgeClass,
} from '@/app/domain/inbound/stagingDisplay';

export type StagingEventRow = {
  id: string;
  tenant_id: string;
  source: string;
  extracted_upi: string | null;
  status: string;
  payload: Record<string, unknown>;
  merged_upi?: string | null;
  merge_error?: string | null;
  created_at: string;
};

type StagingAuditorPanelProps = {
  tenantId: string;
  event: StagingEventRow;
  onClose: () => void;
  onUpdated: () => void;
};

export function StagingAuditorPanel({
  tenantId,
  event,
  onClose,
  onUpdated,
}: StagingAuditorPanelProps) {
  const [detail, setDetail] = useState<{
    preview_draft?: Record<string, unknown> | null;
    preview_error?: string | null;
    sibling_events?: StagingEventRow[];
  } | null>(null);
  const [validationReport, setValidationReport] = useState<InboundValidationReportBundle | null>(null);
  const [gaps, setGaps] = useState<InboundGapRecord[]>([]);
  const [readinessScore, setReadinessScore] = useState<number | null>(null);
  const [assignUpi, setAssignUpi] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    const response = await fetch(
      `/api/inbound/staging/events/${encodeURIComponent(event.id)}?tenantId=${encodeURIComponent(tenantId)}`,
    );
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.error ?? body.detail ?? `HTTP ${response.status}`);
    }
    setDetail({
      preview_draft: body.preview_draft,
      preview_error: body.preview_error,
      sibling_events: body.sibling_events,
    });
  }, [event.id, tenantId]);

  const loadPreviewValidate = useCallback(async () => {
    const response = await fetch(
      `/api/inbound/staging/events/${encodeURIComponent(event.id)}/preview-validate?tenantId=${encodeURIComponent(tenantId)}`,
      { method: 'POST' },
    );
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.detail ?? body.error ?? `HTTP ${response.status}`);
    }
    setValidationReport(body.validation_report ?? null);
    setGaps(Array.isArray(body.gaps) ? body.gaps : []);
    setReadinessScore(typeof body.readiness_score_percent === 'number' ? body.readiness_score_percent : null);
  }, [event.id, tenantId]);

  useEffect(() => {
    void (async () => {
      setError(null);
      try {
        await loadDetail();
        await loadPreviewValidate();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Laden fehlgeschlagen');
      }
    })();
  }, [loadDetail, loadPreviewValidate]);

  const auditRows = useMemo(
    () => buildDraftAuditRows(validationReport, gaps),
    [validationReport, gaps],
  );
  const grouped = useMemo(() => groupAuditRowsByBlock(auditRows), [auditRows]);

  async function runAction(path: string, options?: RequestInit) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/inbound/staging/events/${encodeURIComponent(event.id)}/${path}?tenantId=${encodeURIComponent(tenantId)}`,
        options,
      );
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.detail ?? body.error ?? `HTTP ${response.status}`);
      }
      onUpdated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aktion fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  const previewPayload = detail?.preview_draft ?? {};

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
        aria-label="Staging-Auditor schließen"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        <header className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Staging Auditor</p>
              <h2 className="mt-1 text-lg font-bold text-[#0c1929]">
                {event.extracted_upi ?? 'Ohne Anker-UPI'}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {STAGING_SOURCE_LABELS[event.source] ?? event.source} ·{' '}
                <span className={`rounded-full px-2 py-0.5 ${stagingStatusBadgeClass(event.status)}`}>
                  {STAGING_STATUS_LABELS[event.status as keyof typeof STAGING_STATUS_LABELS] ?? event.status}
                </span>
              </p>
              {event.merge_error ? (
                <p className="mt-2 text-xs text-red-700">{event.merge_error}</p>
              ) : null}
              {event.merged_upi ? (
                <p className="mt-1 text-xs text-emerald-700">Passport: {event.merged_upi}</p>
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
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
          ) : null}

          {readinessScore != null ? (
            <p className="text-sm text-slate-600">
              ESPR-Vorschau: <span className="font-semibold">{readinessScore.toFixed(1)}%</span>
            </p>
          ) : null}

          {detail?.preview_error ? (
            <p className="text-sm text-amber-800">{detail.preview_error}</p>
          ) : null}

          <DraftStammdatenSection payload={previewPayload} />

          {event.status === 'ORPHAN' ? (
            <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-4">
              <label className="text-xs font-semibold text-violet-900">UPI zuordnen</label>
              <div className="mt-2 flex gap-2">
                <input
                  value={assignUpi}
                  onChange={(e) => setAssignUpi(e.target.value)}
                  className="flex-1 rounded-lg border border-violet-200 px-3 py-2 text-sm"
                  placeholder="Artikelnummer / SKU"
                />
                <button
                  type="button"
                  disabled={busy || !assignUpi.trim()}
                  onClick={() =>
                    void runAction('assign-upi', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ upi: assignUpi.trim() }),
                    })
                  }
                  className="rounded-lg bg-violet-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  Zuordnen & mergen
                </button>
              </div>
            </div>
          ) : null}

          {(event.status === 'PENDING' || event.status === 'CONFLICT') && event.merge_error ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void runAction('merge', { method: 'POST' })}
              className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-800"
            >
              Erneut mergen
            </button>
          ) : null}

          {event.status === 'CONFLICT' ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-slate-500">Konflikt — weitere Events</p>
              {(detail?.sibling_events ?? []).map((sibling) => (
                <div
                  key={sibling.id}
                  className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50/50 px-3 py-2 text-xs"
                >
                  <span>{sibling.id.slice(0, 8)}… · {sibling.status}</span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runAction('dismiss', { method: 'POST' })}
                    className="text-red-700 underline"
                  >
                    Dieses verwerfen
                  </button>
                </div>
              ))}
              <button
                type="button"
                disabled={busy}
                onClick={() => void runAction('merge', { method: 'POST' })}
                className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Dieses Event mergen
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void runAction('dismiss', { method: 'POST' })}
                className="ml-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                Verwerfen
              </button>
            </div>
          ) : null}

          <details className="rounded-lg border border-slate-200 p-3 text-xs">
            <summary className="cursor-pointer font-medium text-slate-700">Roh-Payload</summary>
            <pre className="mt-2 overflow-x-auto text-[11px] text-slate-600">
              {JSON.stringify(event.payload, null, 2)}
            </pre>
          </details>

          {grouped.size > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase text-slate-500">ESPR-Felder (Vorschau)</p>
              {Array.from(grouped.entries()).map(([block, blockRows]) => (
                <div key={block}>
                  <p className="text-xs font-medium text-slate-700">{block}</p>
                  <ul className="mt-1 space-y-1">
                    {blockRows.slice(0, 12).map((row) => (
                      <li key={row.path} className="flex justify-between text-xs text-slate-600">
                        <span>{row.label}</span>
                        <span>{row.value ?? '—'}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {busy ? (
          <div className="border-t border-slate-100 px-5 py-3 text-sm text-slate-500">
            <Loader2 className="inline h-4 w-4 animate-spin" /> Bitte warten…
          </div>
        ) : null}
      </aside>
    </div>
  );
}
