'use client';

import { useCallback, useEffect, useState } from 'react';
import { Brain, ChevronLeft, Loader2, Upload } from 'lucide-react';

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

interface StatsResponse {
  readonly tenantId: string;
  readonly indexStats: IngestResponse['indexStats'];
}

export default function RagIngestDashboard() {
  const [tenantId, setTenantId] = useState('default');
  const [stats, setStats] = useState<StatsResponse['indexStats'] | null>(null);
  const [lastResponse, setLastResponse] = useState<IngestResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-100 p-8">
      <div className="max-w-3xl mx-auto">
        <a
          href="/dashboard/create"
          className="inline-flex items-center gap-1 text-sm text-indigo-700 hover:text-indigo-900 mb-6"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden />
          Zurück zum Produkt-Dashboard
        </a>

        <div className="flex items-start gap-4 mb-8">
          <div className="p-3 rounded-xl bg-white shadow border border-indigo-100">
            <Brain className="w-10 h-10 text-indigo-600" aria-hidden />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">RAG-Wissensbasis</h1>
            <p className="text-gray-600 mt-1">
              Mehrere PDFs hochladen, um den Compliance-RAG-Index (Chunking + Embeddings) für diesen
              Mandanten zu befüllen.
            </p>
          </div>
        </div>

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
            Hinweis: Der MVP-Index liegt im Arbeitsspeicher dieses Server-Prozesses. Nach Neustart des
            Servers oder bei Serverless-Cold-Starts ist der Index leer — für Produktion einen
            persistenten Vector Store (z. B. Pinecone, pgvector) anbinden.
          </p>
        </div>
      </div>
    </div>
  );
}
