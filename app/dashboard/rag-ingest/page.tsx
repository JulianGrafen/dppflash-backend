'use client';

import { useCallback, useEffect, useState } from 'react';
import { Boxes, Brain, ChevronLeft, Loader2, Trash2, Upload } from 'lucide-react';
import { RagBrainPanel } from '@/app/dashboard/rag-ingest/RagBrainPanel';

type RagTab = 'ingest' | 'brain';

interface IngestResultRow {
  readonly fileName: string;
  readonly chunkCount: number;
  readonly ok: boolean;
  readonly error?: string;
}

interface IngestResponse {
  readonly tenantId: string;
  readonly results: readonly IngestResultRow[];
  readonly totalChunksAdded: number;
  readonly indexStats: {
    readonly chunkCount: number;
    readonly distinctFileNames: readonly string[];
  };
}

interface PurgeResponse {
  readonly tenantId: string;
  readonly deleteRagChunks: boolean;
  readonly deletePdfUploadObjects: boolean;
  readonly ragChunksDeleted: number;
  readonly pdfStorageObjectsDeleted: number;
  readonly error?: string;
}

export default function RagIngestDashboard() {
  const [tenantId, setTenantId] = useState('default');
  const [tab, setTab] = useState<RagTab>('ingest');
  const [stats, setStats] = useState<StatsResponse['indexStats'] | null>(null);
  const [lastResponse, setLastResponse] = useState<IngestResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [purgeIncludePdfStorage, setPurgeIncludePdfStorage] = useState(false);
  const [lastPurge, setLastPurge] = useState<PurgeResponse | null>(null);

  const refreshStats = useCallback(async () => {
    setIsLoadingStats(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/rag/stats?tenantId=${encodeURIComponent(tenantId)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as StatsResponse;
      setStats(data.indexStats);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'Statistik konnte nicht geladen werden');
    } finally {
      setIsLoadingStats(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void refreshStats();
  }, [refreshStats]);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList?.length) {
      return;
    }

    const pdfs = [...fileList].filter((f) => f.type === 'application/pdf');
    if (pdfs.length !== fileList.length) {
      setErrorMessage('Nur PDF-Dateien sind erlaubt.');
      return;
    }

    const oversized = pdfs.find((f) => f.size > 10 * 1024 * 1024);
    if (oversized) {
      setErrorMessage(`Datei zu groß (max 10 MB): ${oversized.name}`);
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);
    setLastResponse(null);

    const formData = new FormData();
    for (const f of pdfs) {
      formData.append('files', f);
    }

    try {
      const res = await fetch(`/api/rag/ingest?tenantId=${encodeURIComponent(tenantId)}`, {
        method: 'POST',
        body: formData,
      });

      const body = (await res.json().catch(() => ({}))) as IngestResponse & { error?: string };

      if (!res.ok) {
        throw new Error(body.error || `Upload fehlgeschlagen (${res.status})`);
      }

      setLastResponse(body as IngestResponse);
      setStats(body.indexStats);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'Upload fehlgeschlagen');
    } finally {
      setIsUploading(false);
    }
  };

  const handlePurge = async () => {
    const pdfHint = purgeIncludePdfStorage
      ? '\n\nZusätzlich werden PDF-Dateien unter pdf-uploads/tenants/{tenant}/ gelöscht.'
      : '\n\nPDF-Uploads im Storage bleiben unverändert.';
    const ok = window.confirm(
      `RAG-Index für Mandant „${tenantId}“ wirklich leeren? Alle Chunks für diesen tenantId werden entfernt.${pdfHint}`,
    );
    if (!ok) {
      return;
    }

    setIsPurging(true);
    setErrorMessage(null);
    setLastPurge(null);
    try {
      const res = await fetch('/api/rag/purge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          deleteRagChunks: true,
          deletePdfUploadObjects: purgeIncludePdfStorage,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as PurgeResponse & { error?: string };
      if (!res.ok) {
        throw new Error(body.error || `Purge fehlgeschlagen (${res.status})`);
      }
      setLastPurge(body as PurgeResponse);
      setLastResponse(null);
      await refreshStats();
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'Purge fehlgeschlagen');
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-100 p-8">
      <div className="max-w-5xl mx-auto">
        <a
          href="/dashboard/create"
          className="inline-flex items-center gap-1 text-sm text-indigo-700 hover:text-indigo-900 mb-6"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden />
          Zurück zum Produkt-Dashboard
        </a>

        <div className="flex items-start gap-4 mb-6">
          <div className="p-3 rounded-xl bg-white shadow border border-indigo-100">
            <Brain className="w-10 h-10 text-indigo-600" aria-hidden />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">RAG-Wissensbasis</h1>
            <p className="text-gray-600 mt-1">
              PDFs indexieren und den Mandanten-Chunk-Speicher einsehen — was das Retrieval-„Gehirn“ gerade
              kennt.
            </p>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-2 border-b border-indigo-200/60">
          <button
            type="button"
            onClick={() => setTab('ingest')}
            className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === 'ingest'
                ? 'border-indigo-600 text-indigo-900'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Upload className="h-4 w-4 shrink-0" aria-hidden />
            Index befüllen
          </button>
          <button
            type="button"
            onClick={() => setTab('brain')}
            className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === 'brain'
                ? 'border-indigo-600 text-indigo-900'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Boxes className="h-4 w-4 shrink-0" aria-hidden />
            Gehirn ansehen
          </button>
        </div>

        {tab === 'ingest' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
          <div>
            <label htmlFor="tenantId" className="block text-sm font-medium text-gray-700 mb-1">
              Mandant (tenantId)
            </label>
            <input
              id="tenantId"
              type="text"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm"
              autoComplete="off"
            />
            <p className="text-xs text-gray-500 mt-1">
              Muss dem Mandanten entsprechen, den Sie später bei Abfragen verwenden. Zeichen: Buchstaben,
              Ziffern, <code className="text-gray-700">._-</code>, Länge 3–128.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium cursor-pointer hover:bg-indigo-700 transition-colors">
              {isUploading ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
              ) : (
                <Upload className="w-4 h-4" aria-hidden />
              )}
              PDFs auswählen (mehrere möglich)
              <input
                type="file"
                accept="application/pdf"
                multiple
                className="hidden"
                disabled={isUploading}
                onChange={(e) => void handleFiles(e.target.files)}
              />
            </label>

            <button
              type="button"
              onClick={() => void refreshStats()}
              disabled={isLoadingStats}
              className="text-sm text-indigo-700 hover:underline disabled:opacity-50"
            >
              Index-Statistik aktualisieren
            </button>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50/90 p-4 space-y-3">
            <p className="text-sm font-medium text-amber-950">Index leeren (Purge)</p>
            <p className="text-xs text-amber-900/90">
              Entfernt alle RAG-Chunks für den oben eingetragenen Mandanten. Optional auch PDF-Objekte im
              Bucket <code className="text-amber-950/90">pdf-uploads</code> unter{' '}
              <code className="text-amber-950/90">tenants/{'{tenantId}'}/</code>.
            </p>
            <label className="flex items-center gap-2 text-sm text-amber-950 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={purgeIncludePdfStorage}
                onChange={(e) => setPurgeIncludePdfStorage(e.target.checked)}
                disabled={isPurging || isUploading}
                className="rounded border-amber-400 text-amber-700 focus:ring-amber-500"
              />
              PDF-Uploads im Storage mitlöschen
            </label>
            <div>
              <button
                type="button"
                onClick={() => void handlePurge()}
                disabled={isPurging || isUploading}
                className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-50 disabled:opacity-50"
              >
                {isPurging ? (
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden />
                ) : (
                  <Trash2 className="w-4 h-4 shrink-0" aria-hidden />
                )}
                Index leeren
              </button>
            </div>
            {lastPurge && (
              <p className="text-xs text-amber-900/90 border-t border-amber-200/80 pt-3">
                Zuletzt: {lastPurge.ragChunksDeleted} Chunk-Zeilen entfernt
                {lastPurge.deletePdfUploadObjects
                  ? ` · ${lastPurge.pdfStorageObjectsDeleted} Storage-Objekt(e) in pdf-uploads`
                  : ''}
                .
              </p>
            )}
          </div>

          {stats && (
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-sm">
              <p className="font-medium text-gray-800">Aktueller Index für „{tenantId}“</p>
              <ul className="mt-2 text-gray-600 list-disc list-inside space-y-1">
                <li>{stats.chunkCount} Chunks gespeichert</li>
                <li>{stats.distinctFileNames.length} verschiedene Quelldateien</li>
              </ul>
              {stats.distinctFileNames.length > 0 && (
                <p className="mt-2 text-xs text-gray-500 break-words">
                  Dateien: {stats.distinctFileNames.join(', ')}
                </p>
              )}
            </div>
          )}

          {errorMessage && (
            <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm px-4 py-3">
              {errorMessage}
            </div>
          )}

          {lastResponse && (
            <div>
              <h2 className="text-sm font-semibold text-gray-800 mb-2">Letzter Upload</h2>
              <p className="text-xs text-gray-500 mb-2">
                Neu indexierte Chunks in diesem Durchlauf: {lastResponse.totalChunksAdded}
              </p>
              <ul className="space-y-2">
                {lastResponse.results.map((r, i) => (
                  <li
                    key={`${r.fileName}-${i}`}
                    className={`text-sm rounded border px-3 py-2 ${
                      r.ok ? 'border-green-200 bg-green-50 text-green-900' : 'border-amber-200 bg-amber-50 text-amber-900'
                    }`}
                  >
                    <span className="font-medium">{r.fileName}</span>
                    {r.ok ? (
                      <span className="ml-2">— {r.chunkCount} Chunks</span>
                    ) : (
                      <span className="ml-2">— {r.error ?? 'Fehler'}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-gray-500 border-t border-gray-100 pt-4">
            Hinweis: Ohne Supabase-Umgebungsvariablen liegt der Index nur im RAM dieses Server-Prozesses.
            Mit <code className="text-gray-700">NEXT_PUBLIC_SUPABASE_URL</code> und{' '}
            <code className="text-gray-700">SUPABASE_SERVICE_ROLE_KEY</code> (plus Migration{' '}
            <code className="text-gray-700">rag_chunks</code>) werden Chunks in Postgres persistiert und
            überleben Deployments. Sehr große Mandanten: Abruf aktuell auf 8&nbsp;000 Chunks pro Suche
            begrenzt (Hybrid-Ranking im Prozess).
          </p>
        </div>
        )}

        {tab === 'brain' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <p className="text-sm text-gray-600 mb-5">
              Mandant wie unter „Index befüllen“: <strong className="text-gray-900">{tenantId}</strong> — dort
              die ID ändern, falls Sie einen anderen Index ansehen möchten.
            </p>
            <RagBrainPanel tenantId={tenantId} stats={stats} onRefreshStats={refreshStats} />
          </div>
        )}
      </div>
    </div>
  );
}
