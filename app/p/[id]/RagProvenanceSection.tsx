import type { AuditedValue } from '@/app/domain/rag/auditTrailSchema';

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
      <section className="bg-white rounded-xl border border-amber-100 shadow-sm overflow-hidden">
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 px-5 py-3 border-b border-gray-50 bg-amber-50/60">
          RAG / Forensik
        </h2>
        <div className="px-5 py-4 text-sm text-amber-900">{msg}</div>
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
    <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 px-5 py-3 border-b border-gray-50 bg-slate-50">
        RAG — Quellen & Belege
      </h2>
      <div className="px-5 py-4 space-y-3 text-sm border-b border-gray-50 bg-slate-50/40">
        <p className="text-gray-700">
          <span className="font-medium text-gray-900">Übernommene Felder:</span>{' '}
          {applied.length > 0
            ? applied.join(', ')
            : cryptoOk
              ? 'keine (RAG lieferte nichts Übernehmbares, alle Werte null / bereits befüllt, oder keine passenden Chunks).'
              : 'keine — alle vorgeschlagenen Werte scheiterten an der Krypto-/Formatprüfung (siehe unten).'}
        </p>
        {!cryptoOk && cryptoErrors.length > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <p className="font-semibold mb-1">Krypto-/Formatprüfung</p>
            {applied.length > 0 ? (
              <p className="mb-2 text-amber-950/90">
                Hinweis: Felder, die die Prüfung bestanden haben, sind trotzdem ins Pass übernommen worden.
              </p>
            ) : null}
            <ul className="list-disc list-inside space-y-0.5">
              {cryptoErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <div className="px-5 py-4 text-sm text-gray-500">
          Keine auditierten RAG-Felder im Trail (Modell hat vermutlich null geliefert oder nichts extrahiert).
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {rows.map(({ key, entry }) => (
            <li key={key} className="px-5 py-4 space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-indigo-700">{key}</span>
                <span className="text-xs text-gray-500">
                  Konfidenz {(entry.confidence * 100).toFixed(0)} %
                  {entry.requiresManualReview ? ' · manuelle Prüfung' : ''}
                </span>
              </div>
              <p className="text-sm font-medium text-gray-900 break-words">{formatAuditedValue(entry)}</p>
              <dl className="grid gap-1 text-xs text-gray-600">
                <div>
                  <dt className="inline text-gray-500">Quelle:</dt>{' '}
                  <dd className="inline font-medium text-gray-800">{entry.source.fileName}</dd>
                  <span className="text-gray-400"> · </span>
                  <dd className="inline">Seite {entry.source.pageNumber}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 mb-0.5">Kontext (Chunk-Auszug)</dt>
                  <dd className="rounded-md bg-gray-50 border border-gray-100 p-2 font-mono text-[11px] leading-relaxed text-gray-800 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
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
