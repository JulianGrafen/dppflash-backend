'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, FileText, Loader2, RefreshCw, Search } from 'lucide-react';

export interface RagBrainChunkRow {
  readonly id: string;
  readonly fileName: string;
  readonly pageNumber: number;
  readonly textPreview: string;
  readonly textLength: number;
  readonly tokenCount: number;
}

interface ChunksApiResponse {
  readonly tenantId: string;
  readonly limit: number;
  readonly offset: number;
  readonly total: number;
  readonly chunks: readonly RagBrainChunkRow[];
  readonly error?: string;
}

interface IndexStats {
  readonly chunkCount: number;
  readonly distinctFileNames: readonly string[];
}

const PAGE_SIZE = 25;
const CONTAINS_DEBOUNCE_MS = 400;

interface RagBrainPanelProps {
  readonly tenantId: string;
  readonly stats: IndexStats | null;
  readonly onRefreshStats: () => Promise<void>;
}

export function RagBrainPanel({ tenantId, stats, onRefreshStats }: RagBrainPanelProps) {
  const [chunks, setChunks] = useState<readonly RagBrainChunkRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [fileFilter, setFileFilter] = useState<string | null>(null);
  const [containsInput, setContainsInput] = useState('');
  const [containsApplied, setContainsApplied] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setContainsApplied(containsInput.trim()), CONTAINS_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [containsInput]);

  useEffect(() => {
    setOffset(0);
  }, [tenantId, fileFilter, containsApplied]);

  const loadChunks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        tenantId,
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (fileFilter) {
        params.set('fileName', fileFilter);
      }
      if (containsApplied) {
        params.set('contains', containsApplied);
      }
      const res = await fetch(`/api/rag/chunks?${params.toString()}`);
      const body = (await res.json().catch(() => ({}))) as ChunksApiResponse & { error?: string };
      if (!res.ok) {
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setChunks(body.chunks ?? []);
      setTotal(typeof body.total === 'number' ? body.total : 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen');
      setChunks([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [tenantId, offset, fileFilter, containsApplied]);

  useEffect(() => {
    void loadChunks();
  }, [loadChunks]);

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(total / PAGE_SIZE) || 1),
    [total],
  );
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const handleRefresh = useCallback(async () => {
    await onRefreshStats();
    await loadChunks();
  }, [onRefreshStats, loadChunks]);

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-violet-200 bg-violet-50/80 p-4 text-sm text-violet-950">
        <p className="font-medium">Index-Überblick</p>
        {stats ? (
          <p className="mt-1 text-violet-900/90">
            {stats.chunkCount} Chunks · {stats.distinctFileNames.length} Quelldatei(en)
            {fileFilter || containsApplied ? (
              <span className="block mt-1 text-xs text-violet-800/80">
                Gefilterte Treffer (API): <strong>{total}</strong>
              </span>
            ) : null}
          </p>
        ) : (
          <p className="mt-1 text-violet-800/80">Statistik noch nicht geladen — Mandanten-ID prüfen oder aktualisieren.</p>
        )}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1 max-w-xl">
          <label htmlFor="brain-search" className="block text-xs font-medium text-gray-600 mb-1">
            Volltext-Filter (Chunk-Inhalt)
          </label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
            <input
              id="brain-search"
              type="search"
              value={containsInput}
              onChange={(e) => setContainsInput(e.target.value)}
              placeholder="z. B. EWC, GTIN, Abschnitt …"
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm"
              autoComplete="off"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleRefresh()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
          Statistik & Liste
        </button>
      </div>

      {stats && stats.distinctFileNames.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-600 mb-2">Nach Datei filtern</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFileFilter(null)}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                fileFilter === null
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-300'
              }`}
            >
              Alle
            </button>
            {stats.distinctFileNames.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setFileFilter((prev) => (prev === name ? null : name))}
                className={`max-w-full truncate rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                  fileFilter === name
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-300'
                }`}
                title={name}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
        <div className="flex items-center justify-between gap-2 border-b border-gray-100 bg-slate-50 px-4 py-2 text-xs text-gray-600">
          <span className="flex items-center gap-2">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500 shrink-0" aria-hidden /> : null}
            Seite {currentPage} / {pageCount} · {total} Treffer
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              disabled={offset <= 0 || loading}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
              className="rounded border border-gray-300 bg-white px-2 py-1 hover:bg-gray-50 disabled:opacity-40"
            >
              Zurück
            </button>
            <button
              type="button"
              disabled={offset + PAGE_SIZE >= total || loading}
              onClick={() => setOffset((o) => o + PAGE_SIZE)}
              className="rounded border border-gray-300 bg-white px-2 py-1 hover:bg-gray-50 disabled:opacity-40"
            >
              Weiter
            </button>
          </div>
        </div>

        {loading && chunks.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Chunks werden geladen …
          </div>
        ) : chunks.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-gray-500">
            Keine Chunks für diesen Mandanten{fileFilter ? ` in „${fileFilter}“` : ''}.
            PDFs unter „Index befüllen“ hochladen oder Filter lockern.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {chunks.map((c) => {
              const open = expandedId === c.id;
              return (
                <li key={c.id} className="hover:bg-slate-50/60">
                  <button
                    type="button"
                    onClick={() => setExpandedId(open ? null : c.id)}
                    className="flex w-full items-start gap-2 px-4 py-3 text-left"
                  >
                    {open ? (
                      <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" aria-hidden />
                    ) : (
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" aria-hidden />
                    )}
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="truncate text-sm font-medium text-gray-900" title={c.fileName}>
                          {c.fileName}
                        </span>
                        <span className="text-xs text-gray-500">
                          S. {c.pageNumber} · {c.tokenCount} Tokens · {c.textLength} Zeichen
                        </span>
                      </div>
                      {!open && (
                        <p className="mt-1 line-clamp-2 text-xs text-gray-600 whitespace-pre-wrap break-words">
                          {c.textPreview}
                        </p>
                      )}
                    </div>
                  </button>
                  {open && (
                    <div className="border-t border-gray-100 bg-slate-50 px-4 py-3 pl-12">
                      <p className="text-xs font-mono text-gray-500 mb-2 break-all">ID: {c.id}</p>
                      <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded border border-gray-200 bg-white p-3 text-xs text-gray-800">
                        {c.textPreview}
                      </pre>
                      {c.textPreview.endsWith('…') ? (
                        <p className="mt-2 text-xs text-amber-800">
                          Vorschau gekürzt — im Index liegt der vollständige Text ({c.textLength} Zeichen). Für
                          Export/Forensik direkt auf <code className="text-gray-700">rag_chunks</code> zugreifen
                          oder die Vorschaulänge im Backend erhöhen.
                        </p>
                      ) : null}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="text-xs text-gray-500">
        Vorschau pro Chunk gekürzt (ca. 480 Zeichen). Volltext stammt aus dem Index; Embeddings werden nicht
        übertragen.
      </p>
    </div>
  );
}
