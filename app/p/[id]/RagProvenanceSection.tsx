import type { AuditedValue } from '@/app/domain/rag/auditTrailSchema';
import { FileSearch } from 'lucide-react';

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
    && typeof v.source.pageNumber === 'number'
    && typeof v.source.contextSnippet === 'string'
  );
}

function formatAuditedValue(entry: AuditedValue): string {
  if (entry.value === null) {
    return '— (null)';
  }
  return String(entry.value);
}

export function RagProvenanceSection({ ragEnrichment }: { readonly ragEnrichment: unknown }) {
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

  const trail = isRecord(ragEnrichment.auditTrail) ? ragEnrichment.auditTrail : {};

  const applied = Array.isArray(ragEnrichment.appliedFieldKeys)
    ? (ragEnrichment.appliedFieldKeys as string[])
    : [];
  const crypto = isRecord(ragEnrichment.cryptoValidation)
    ? ragEnrichment.cryptoValidation
    : undefined;
  const cryptoOk = crypto?.ok === true;
  const cryptoErrors = Array.isArray(crypto?.errors) ? (crypto.errors as string[]) : [];

  const rows: { readonly key: string; readonly entry: AuditedValue }[] = [];
  if (trail.gtin && isAuditedValue(trail.gtin)) {
    rows.push({ key: 'gtin', entry: trail.gtin });
  }
  if (trail.ewcCode && isAuditedValue(trail.ewcCode)) {
    rows.push({ key: 'ewcCode', entry: trail.ewcCode });
  }
  if (trail.fields && isRecord(trail.fields)) {
    for (const [key, val] of Object.entries(trail.fields)) {
      if (isAuditedValue(val)) {
        rows.push({ key, entry: val });
      }
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_28px_-6px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/[0.04]">
      <div className="flex items-center gap-3 bg-[#0c1929] px-5 py-4 text-white">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10">
          <FileSearch className="h-5 w-5 text-sky-300" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight">RAG — Quellen & Belege</h2>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Indizierter Dokumentabgleich
          </p>
        </div>
      </div>
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
        <ul className="divide-y divide-slate-100">
          {rows.map(({ key, entry }) => (
            <li key={key} className="space-y-2 px-5 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="rounded-md bg-sky-50 px-2 py-0.5 font-mono text-[11px] font-bold text-sky-900 ring-1 ring-sky-200/80">
                  {key}
                </span>
                <span className="text-xs font-medium text-slate-500">
                  Konfidenz {(entry.confidence * 100).toFixed(0)} %
                  {entry.requiresManualReview ? ' · manuelle Prüfung' : ''}
                </span>
              </div>
              <p className="break-words text-[13px] font-semibold text-slate-900">{formatAuditedValue(entry)}</p>
              <dl className="grid gap-1 text-xs text-slate-600">
                <div>
                  <dt className="inline text-slate-500">Quelle:</dt>{' '}
                  <dd className="inline font-medium text-slate-800">{entry.source.fileName}</dd>
                  <span className="text-slate-400"> · </span>
                  <dd className="inline">Seite {entry.source.pageNumber}</dd>
                </div>
                <div>
                  <dt className="mb-0.5 text-slate-500">Kontext (Chunk-Auszug)</dt>
                  <dd className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-slate-100 bg-slate-50 p-2 font-mono text-[11px] leading-relaxed text-slate-800">
                    {entry.source.contextSnippet}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
