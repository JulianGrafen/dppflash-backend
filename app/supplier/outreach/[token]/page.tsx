'use client';

import { AlertCircle, CheckCircle2, Loader2, Send } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

interface OutreachGap {
  readonly field_path: string;
  readonly reason: string;
  readonly severity: string;
}

interface ValidateResponse {
  readonly valid: boolean;
  readonly status?: string;
  readonly error?: string;
  readonly product_identifier?: string | null;
  readonly supplier_name?: string | null;
  readonly recipient_email?: string;
  readonly gaps?: readonly OutreachGap[];
  readonly expires_at?: string;
  readonly submitted_at?: string;
}

const INPUT_CLASS =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100';

function gapLabel(fieldPath: string): string {
  return fieldPath.replace(/\./g, ' › ');
}

export default function SupplierOutreachPage() {
  const params = useParams<{ token: string }>();
  const token = typeof params.token === 'string' ? params.token : '';

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<ValidateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const loadSession = useCallback(async () => {
    if (!token) {
      setError('Ungültiger Link — kein Token vorhanden.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/supplier-outreach/validate?token=${encodeURIComponent(token)}`,
      );
      const payload = (await response.json()) as ValidateResponse;

      if (!response.ok || !payload.valid) {
        setError(payload.error ?? 'Dieser Link ist ungültig oder abgelaufen.');
        setSession(null);
        return;
      }

      setSession(payload);
      if (payload.status === 'submitted') {
        setSubmitted(true);
      } else if (payload.gaps?.length) {
        const initial: Record<string, string> = {};
        for (const gap of payload.gaps) {
          initial[gap.field_path] = '';
        }
        setResponses(initial);
      }
    } catch {
      setError('Verbindung zum Server fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!token || submitting) return;

    const filled = Object.fromEntries(
      Object.entries(responses).filter(([, value]) => value.trim().length > 0),
    );
    if (Object.keys(filled).length === 0) {
      setError('Bitte mindestens ein Feld ausfüllen.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/supplier-outreach/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, responses: filled }),
      });
      const payload = (await response.json()) as { error?: string; success?: boolean };

      if (!response.ok) {
        setError(payload.error ?? 'Einreichen fehlgeschlagen.');
        return;
      }

      setSubmitted(true);
    } catch {
      setError('Einreichen fehlgeschlagen — bitte später erneut versuchen.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#eef1f8] pb-12">
      <header className="border-b border-slate-200/90 bg-white shadow-sm">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-2 px-4 sm:px-6">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0c1929] text-[11px] font-bold text-white">
            DPP
          </span>
          <div>
            <p className="text-sm font-bold text-[#0c1929]">Lieferantenportal</p>
            <p className="text-xs text-slate-500">ESPR-Datenanfrage</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-8 sm:px-6">
        {loading ? (
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            <Loader2 className="h-5 w-5 animate-spin text-sky-600" aria-hidden />
            Anfrage wird geladen…
          </div>
        ) : null}

        {!loading && error && !session ? (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <p>{error}</p>
          </div>
        ) : null}

        {!loading && submitted ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-600" aria-hidden />
            <h1 className="text-lg font-bold text-emerald-900">Vielen Dank!</h1>
            <p className="mt-2 text-sm text-emerald-800">
              Ihre Angaben wurden erfolgreich übermittelt. Unser Compliance-Team prüft die Daten
              und meldet sich bei Rückfragen.
            </p>
            {session?.product_identifier ? (
              <p className="mt-3 font-mono text-xs text-emerald-700">
                Produkt: {session.product_identifier}
              </p>
            ) : null}
          </div>
        ) : null}

        {!loading && session && !submitted ? (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">
                Datenanfrage
              </p>
              <h1 className="mt-1 text-xl font-bold text-[#0c1929]">
                {session.product_identifier ?? 'Digitaler Produktpass'}
              </h1>
              {session.supplier_name ? (
                <p className="mt-1 text-sm text-slate-600">{session.supplier_name}</p>
              ) : null}
              <p className="mt-3 text-sm text-slate-600">
                Bitte ergänzen Sie die fehlenden ESPR-Angaben für das oben genannte Produkt.
              </p>
            </div>

            {error ? (
              <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <p>{error}</p>
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-4">
              {(session.gaps ?? []).map((gap) => (
                <fieldset
                  key={gap.field_path}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <legend className="text-sm font-semibold text-[#0c1929]">
                    {gapLabel(gap.field_path)}
                  </legend>
                  <p className="mt-1 text-xs text-slate-500">{gap.reason}</p>
                  <textarea
                    className={`${INPUT_CLASS} mt-3 min-h-[96px]`}
                    value={responses[gap.field_path] ?? ''}
                    onChange={(event) =>
                      setResponses((prev) => ({
                        ...prev,
                        [gap.field_path]: event.target.value,
                      }))
                    }
                    placeholder="Ihre Angabe…"
                    required={false}
                  />
                </fieldset>
              ))}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0c1929] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#152a45] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Send className="h-4 w-4" aria-hidden />
                )}
                Daten einreichen
              </button>
            </form>
          </div>
        ) : null}
      </main>
    </div>
  );
}
