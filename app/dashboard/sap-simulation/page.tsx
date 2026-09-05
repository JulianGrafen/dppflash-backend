'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronLeft,
  Database,
  FileText,
  Loader2,
  Play,
  Sparkles,
} from 'lucide-react';
import {
  BLOCK_LABELS,
  buildDppFieldRows,
  complianceStatusLabel,
  enrichmentStageLabel,
  formatDisplayValue,
  groupFieldRowsByBlock,
  SAMPLE_SAP_DATA,
  SAMPLE_SAP_PRODUCT_ODATA,
  SAMPLE_SDS_TEXT,
  SAP_FIELD_LABELS,
  type PipelineResult,
  type SapMasterDataInput,
} from '@/app/domain/etl/pipelineDisplay';

const INPUT_CLASS =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100';

const CARD_CLASS =
  'overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_28px_-6px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/[0.04]';

function StatusBadge({
  label,
  tone,
}: {
  readonly label: string;
  readonly tone: 'green' | 'amber' | 'red' | 'slate' | 'blue';
}) {
  const tones = {
    green: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    amber: 'bg-amber-50 text-amber-900 ring-amber-200',
    red: 'bg-red-50 text-red-800 ring-red-200',
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
    blue: 'bg-sky-50 text-sky-800 ring-sky-200',
  } as const;

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${tones[tone]}`}>
      {label}
    </span>
  );
}

function FieldStatusDot({ status }: { readonly status: 'filled' | 'sap' | 'missing' | 'empty' }) {
  const colors = {
    filled: 'bg-emerald-500',
    sap: 'bg-sky-500',
    missing: 'bg-red-400',
    empty: 'bg-slate-300',
  } as const;
  return <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${colors[status]}`} aria-hidden />;
}

function DppResultPanel({ result }: { readonly result: PipelineResult }) {
  const rows = useMemo(() => buildDppFieldRows(result), [result]);
  const grouped = useMemo(() => groupFieldRowsByBlock(rows), [rows]);
  const filledCount = rows.filter((row) => row.status === 'filled' || row.status === 'sap').length;
  const readiness = result.validation_report?.readiness_score_percent ?? 0;

  const complianceTone =
    result.compliance_status === 'approved'
      ? 'green'
      : result.compliance_status === 'pending_review'
        ? 'amber'
        : 'slate';

  return (
    <div className="space-y-4">
      <div className={`${CARD_CLASS} p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">Pipeline-Ergebnis</p>
            <h2 className="mt-1 text-lg font-bold text-[#0c1929]">
              {formatDisplayValue(result.extracted_data?.identification?.unique_product_identifier)
                || formatDisplayValue(result.extracted_data?.economic_operator?.manufacturer_name)
                || 'Digitaler Produktpass'}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Kategorie: {String(result.extracted_data?.product_category ?? '—')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge label={complianceStatusLabel(result.compliance_status)} tone={complianceTone} />
            <StatusBadge label={enrichmentStageLabel(result.enrichment_stage)} tone="blue" />
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <MetricCard label="Readiness" value={`${readiness}%`} />
          <MetricCard label="Felder befüllt" value={`${filledCount} / ${rows.length}`} />
          <MetricCard label="Offene Gaps" value={String(result.gaps.length)} />
        </div>

        {result.db_persist_result ? (
          <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600">
            DB: {result.db_persist_result.record_id}
          </p>
        ) : null}

        {result.email_found && result.supplier_email ? (
          <p className="mt-4 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-900">
            SAP-Ansprechpartner:{' '}
            <span className="font-semibold">{formatDisplayValue(result.supplier_email)}</span>
            {result.supplier_email.source_detail ? (
              <span className="mt-1 block text-xs text-sky-800">
                {result.supplier_email.source_detail}
              </span>
            ) : null}
          </p>
        ) : null}

        {resolveOutreachNotes(result) ? (
          <SupplierOutreachMailBlock
            notes={resolveOutreachNotes(result)!}
            recipient={result.metadata?.outreach_recipient as string | undefined}
            enrichmentStage={result.enrichment_stage}
            metadata={result.metadata}
          />
        ) : null}

        {!resolveOutreachNotes(result) && result.enrichment_stage === 'escalated' ? (
          <OutreachSkippedHint result={result} />
        ) : null}
      </div>

      {result.errors.length > 0 ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {result.errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : null}

      <div className={`${CARD_CLASS} p-5`}>
        <div className="mb-4 flex flex-wrap gap-4 text-xs text-slate-600">
          <LegendItem color="bg-emerald-500" label="Aus SDS / LLM" />
          <LegendItem color="bg-sky-500" label="Aus SAP-Stammdaten" />
          <LegendItem color="bg-red-400" label="Gap / fehlend" />
          <LegendItem color="bg-slate-300" label="Leer" />
        </div>

        {[...grouped.entries()].map(([block, blockRows]) => (
          <section key={block} className="mb-6 last:mb-0">
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
              {BLOCK_LABELS[block] ?? block}
            </h3>
            <dl className="divide-y divide-slate-100 rounded-xl border border-slate-100">
              {blockRows.map((row) => (
                <div key={row.path} className="flex gap-3 px-3 py-2.5">
                  <FieldStatusDot status={row.status} />
                  <div className="min-w-0 flex-1">
                    <dt className="text-xs font-medium text-slate-500">{row.label}</dt>
                    <dd className="mt-0.5 text-sm text-[#0c1929]">
                      {row.value ?? (
                        <span className="italic text-slate-400">
                          {row.status === 'missing' ? 'Nicht verfügbar' : '—'}
                        </span>
                      )}
                      {row.source_detail ? (
                        <p className="mt-1 text-xs text-slate-500" title={row.source_system ?? undefined}>
                          Quelle: {row.source_detail}
                        </p>
                      ) : null}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      {result.gap_remediation?.recommended_actions.length ? (
        <div className={`${CARD_CLASS} p-5`}>
          <h3 className="text-sm font-bold text-[#0c1929]">Empfohlene Maßnahmen</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
            {result.gap_remediation.recommended_actions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function MetricCard({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-bold text-[#0c1929]">{value}</p>
    </div>
  );
}

function LegendItem({ color, label }: { readonly color: string; readonly label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${color}`} aria-hidden />
      {label}
    </span>
  );
}

function resolveOutreachNotes(result: PipelineResult): string | null {
  const fromMetadata = result.metadata?.last_supplier_outreach;
  if (typeof fromMetadata === 'string' && fromMetadata.trim()) {
    return fromMetadata;
  }
  const fromEnrichment = result.enrichment_result?.notes;
  if (
    typeof fromEnrichment === 'string' &&
    fromEnrichment.trim() &&
    /supplier outreach|magic link|lieferanten/i.test(fromEnrichment)
  ) {
    return fromEnrichment;
  }
  return null;
}

function parseOutreachNotes(notes: string): {
  mode: 'SMTP' | 'Dry-Run' | null;
  magicLink: string | null;
  failed: boolean;
} {
  const modeMatch = notes.match(/\[(SMTP|Dry-Run)\]/);
  const linkMatch = notes.match(/Magic link:\s*(https?:\/\/\S+)/);
  return {
    mode: modeMatch?.[1] === 'SMTP' ? 'SMTP' : modeMatch?.[1] === 'Dry-Run' ? 'Dry-Run' : null,
    magicLink: linkMatch?.[1] ?? null,
    failed: /failed|fehlgeschlagen|not configured|skipped/i.test(notes),
  };
}

function OutreachSkippedHint({ result }: { readonly result: PipelineResult }) {
  const hasSapExport = Boolean(result.metadata?.input_format === 'sap_product_odata');
  const contactError = result.errors.find((error) =>
    /sap_enrichment|contact|sap_export|Lieferanten-E-Mail/i.test(error),
  );

  return (
    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
      <p className="font-semibold">Keine Lieferanten-Mail ausgelöst</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
        {!hasSapExport ? (
          <li>
            Kein SAP OData JSON im Request — Mailversand braucht{' '}
            <code className="rounded bg-amber-100 px-1">sap_export</code> mit Kontakt unter{' '}
            <code className="rounded bg-amber-100 px-1">to_ContactPerson</code>.
          </li>
        ) : null}
        {contactError ? <li>{contactError}</li> : null}
        <li>
          Auf Render:{' '}
          <code className="rounded bg-amber-100 px-1">SUPPLIER_OUTREACH_SECRET</code> setzen
          (Magic Link). Für echten Versand zusätzlich{' '}
          <code className="rounded bg-amber-100 px-1">SUPPLIER_OUTREACH_ENABLED=true</code> und
          SMTP-Variablen.
        </li>
      </ul>
    </div>
  );
}

function SupplierOutreachMailBlock({
  notes,
  recipient,
  enrichmentStage,
  metadata,
}: {
  readonly notes: string;
  readonly recipient?: string;
  readonly enrichmentStage: string;
  readonly metadata?: Record<string, unknown>;
}) {
  const { mode, magicLink, failed } = parseOutreachNotes(notes);
  const tone = failed
    ? 'border-red-200 bg-red-50 text-red-900'
    : 'border-emerald-100 bg-emerald-50 text-emerald-900';

  return (
    <div className={`mt-4 rounded-lg px-3 py-3 text-sm ${tone}`}>
      <p className="font-semibold">
        Lieferanten-Mail{enrichmentStage === 'escalated' ? ' (Pipeline eskaliert)' : ''}
      </p>
      <dl className="mt-2 space-y-1 text-xs">
        {mode ? (
          <div className="flex gap-2">
            <dt className="font-medium opacity-80">Modus:</dt>
            <dd>{mode}</dd>
          </div>
        ) : null}
        {recipient ? (
          <div className="flex gap-2">
            <dt className="font-medium opacity-80">Empfänger:</dt>
            <dd className="font-mono">{recipient}</dd>
          </div>
        ) : null}
        {magicLink ? (
          <div>
            <dt className="font-medium opacity-80">Magic Link:</dt>
            <dd className="mt-1 break-all font-mono text-[11px]">{magicLink}</dd>
          </div>
        ) : null}
        {failed && !magicLink ? (
          <div>
            <dt className="font-medium opacity-80">Hinweis:</dt>
            <dd className="mt-1 text-xs">
              {notes.includes('not configured') ? (
                <>
                  Node/Python sehen das Secret nicht — prüfe Render Env{' '}
                  <code className="rounded bg-white/60 px-1">SUPPLIER_OUTREACH_SECRET</code> und
                  rufe <code className="rounded bg-white/60 px-1">GET /api/etl/diagnostics</code>{' '}
                  auf.
                </>
              ) : (
                'SMTP-Konfiguration auf dem Server prüfen.'
              )}
            </dd>
          </div>
        ) : null}
        {metadata?._node_env_debug || metadata?._pipeline_env_debug ? (
          <div className="mt-2 rounded bg-white/50 px-2 py-1 font-mono text-[10px]">
            Debug: {JSON.stringify(metadata._node_env_debug ?? null)} /{' '}
            {JSON.stringify(metadata._pipeline_env_debug ?? null)}
          </div>
        ) : null}
      </dl>
      <p className="mt-2 text-xs opacity-80">{notes}</p>
    </div>
  );
}

export default function SapSimulationPage() {
  const [sapData, setSapData] = useState<SapMasterDataInput>(SAMPLE_SAP_DATA);
  const [sapProductJson, setSapProductJson] = useState(() =>
    JSON.stringify(SAMPLE_SAP_PRODUCT_ODATA, null, 2),
  );
  const [documentText, setDocumentText] = useState(SAMPLE_SDS_TEXT);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PipelineResult | null>(null);

  async function runPipeline() {
    setIsLoading(true);
    setError(null);
    setResult(null);

    let sapExport: unknown;
    try {
      sapExport = JSON.parse(sapProductJson);
    } catch {
      setError('SAP OData JSON ist ungültig — bitte Syntax prüfen.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/etl/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku_master_data: sapData,
          sap_export: sapExport,
          raw_document: {
            filename: 'sds.pdf',
            document_text: documentText,
          },
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? 'Pipeline fehlgeschlagen');
      }

      setResult(payload.result as PipelineResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setIsLoading(false);
    }
  }

  function loadSampleData() {
    setSapData(SAMPLE_SAP_DATA);
    setSapProductJson(JSON.stringify(SAMPLE_SAP_PRODUCT_ODATA, null, 2));
    setDocumentText(SAMPLE_SDS_TEXT);
    setResult(null);
    setError(null);
  }

  return (
    <div className="min-h-screen bg-[#eef1f8] pb-12">
      <nav className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/90 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0c1929] text-[11px] font-bold text-white">
              DPP
            </span>
            <span className="text-sm font-bold tracking-tight text-[#0c1929]">
              flash <span className="font-normal text-slate-400">· SAP Simulation</span>
            </span>
          </div>
          <Link
            href="/dashboard/create"
            className="text-xs font-medium text-sky-700 underline decoration-sky-200 underline-offset-2 hover:text-sky-900"
          >
            PDF-Upload
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
        <Link
          href="/dashboard/create"
          className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition hover:text-[#0c1929]"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Dashboard
        </Link>

        <header className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">ESPR Pipeline Demo</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#0c1929] sm:text-3xl">
            SAP-Stammdaten → DPP
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            SAP OData JSON + SDS-Text. Kontakt-E-Mail und Lieferanten-Mail kommen immer aus dem aktuellen JSON —
            nicht aus Stammdaten-Feldern oder dem SDS.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <section className={`${CARD_CLASS} p-5`}>
              <div className="mb-4 flex items-center gap-2">
                <Database className="h-5 w-5 text-sky-700" aria-hidden />
                <h2 className="text-base font-bold text-[#0c1929]">SAP OData JSON (A_Product)</h2>
              </div>
              <p className="mb-4 text-xs text-slate-500">
                Kontakte für den Mailversand werden bei jedem Lauf frisch aus diesem JSON gelesen (
                <code className="rounded bg-slate-100 px-1">to_BillOfMaterial → … → to_ContactPerson</code>
                ).
              </p>
              <textarea
                className={`${INPUT_CLASS} min-h-[280px] font-mono text-xs leading-relaxed`}
                value={sapProductJson}
                onChange={(event) => setSapProductJson(event.target.value)}
                spellCheck={false}
              />
            </section>

            <section className={`${CARD_CLASS} p-5`}>
              <div className="mb-4 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-sky-700" aria-hidden />
                <h2 className="text-base font-bold text-[#0c1929]">SAP / WWS Stammdaten</h2>
              </div>
              <p className="mb-4 text-xs text-slate-500">
                Entspricht <code className="rounded bg-slate-100 px-1">sku_master_data</code> im LangGraph-State.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {(Object.keys(SAP_FIELD_LABELS) as Array<keyof SapMasterDataInput>).map((key) => (
                  <label key={key} className="block sm:col-span-2">
                    <span className="mb-1 block text-xs font-semibold text-slate-600">
                      {SAP_FIELD_LABELS[key]}
                    </span>
                    <input
                      className={INPUT_CLASS}
                      value={sapData[key]}
                      onChange={(event) => setSapData((prev) => ({ ...prev, [key]: event.target.value }))}
                    />
                  </label>
                ))}
              </div>
            </section>

            <section className={`${CARD_CLASS} p-5`}>
              <div className="mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-sky-700" aria-hidden />
                <h2 className="text-base font-bold text-[#0c1929]">SDS / Quelldokument</h2>
              </div>
              <textarea
                className={`${INPUT_CLASS} min-h-[220px] font-mono text-xs leading-relaxed`}
                value={documentText}
                onChange={(event) => setDocumentText(event.target.value)}
                placeholder="Sicherheitsdatenblatt-Text einfügen…"
              />
            </section>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={runPipeline}
                disabled={isLoading || !documentText.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-[#0c1929] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#152a45] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Pipeline starten
              </button>
              <button
                type="button"
                onClick={loadSampleData}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Sparkles className="h-4 w-4" />
                Beispieldaten
              </button>
            </div>

            {error ? (
              <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <p>{error}</p>
              </div>
            ) : null}

            {isLoading ? (
              <div className={`${CARD_CLASS} flex items-center gap-3 p-4 text-sm text-slate-600`}>
                <Loader2 className="h-5 w-5 animate-spin text-sky-600" aria-hidden />
                LangGraph läuft (Extraktion → Validierung → SAP-Anreicherung)…
              </div>
            ) : null}
          </div>

          <div>
            <div className="mb-3 flex items-center gap-2">
              <Database className="h-5 w-5 text-sky-700" aria-hidden />
              <h2 className="text-base font-bold text-[#0c1929]">DPP-Anzeige</h2>
            </div>

            {!result && !isLoading ? (
              <div className={`${CARD_CLASS} flex flex-col items-center justify-center px-6 py-16 text-center`}>
                <CheckCircle2 className="mb-3 h-10 w-10 text-slate-300" aria-hidden />
                <p className="text-sm text-slate-500">
                  Nach dem Pipeline-Lauf erscheint hier der DPP — mit farblich markierten Feldern je nach
                  Datenquelle (SDS, SAP, fehlend).
                </p>
              </div>
            ) : null}

            {result ? <DppResultPanel result={result} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
