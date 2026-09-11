'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';

import {
  EMPTY_STAMMDATEN_FORM,
  STAMMDATEN_FIELD_DEFS,
  type StammdatenFormState,
  stammdatenFormToApiPayload,
  stammdatenFromApiRecord,
} from '@/app/domain/inbound/stammdatenDisplay';

const CARD_CLASS =
  'overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_28px_-6px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/[0.04]';

type StammdatenFieldsCardProps = {
  tenantId: string;
};

export function StammdatenFieldsCard({ tenantId }: StammdatenFieldsCardProps) {
  const [form, setForm] = useState<StammdatenFormState>(EMPTY_STAMMDATEN_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/inbound/stammdaten?tenantId=${encodeURIComponent(tenantId)}`,
      );
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error ?? `HTTP ${response.status}`);
      }
      setForm(stammdatenFromApiRecord(body.stammdaten as Record<string, unknown> | null));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Laden fehlgeschlagen');
      setForm(EMPTY_STAMMDATEN_FORM);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(
        `/api/inbound/stammdaten?tenantId=${encodeURIComponent(tenantId)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(stammdatenFormToApiPayload(form)),
        },
      );
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.detail ?? body.error ?? `HTTP ${response.status}`);
      }
      setForm(stammdatenFromApiRecord(body.stammdaten as Record<string, unknown>));
      setMessage('Stammdaten gespeichert — werden bei Import und Validierung auf alle Produkte angewendet.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`${CARD_CLASS} p-5`}>
      <h2 className="font-semibold text-[#0c1929]">Stammdaten (Wirtschaftsbeteiligter)</h2>
      <p className="mt-1 text-xs text-slate-500">
        Pflicht-Stammdaten für den ESPR-Wirtschaftsbeteiligten — hier pro Tenant eintragen, nicht aus
        Excel/Produktzeilen. Gelten für alle Passports dieses Tenants beim Speichern und Validieren.
      </p>

      {loading ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Lade Stammdaten…
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {STAMMDATEN_FIELD_DEFS.map((field) => (
            <label key={field.key} className="block">
              <span className="text-xs font-semibold text-slate-600">{field.label}</span>
              {field.multiline ? (
                <textarea
                  value={form[field.key]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              ) : (
                <input
                  value={form[field.key]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              )}
            </label>
          ))}

          <fieldset className="rounded-xl border border-slate-200/80 p-4">
            <legend className="px-1 text-xs font-semibold text-slate-600">Kontakt</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block text-xs">
                <span className="text-slate-500">Ansprechpartner</span>
                <input
                  value={form.kontaktName}
                  onChange={(e) => setForm((prev) => ({ ...prev, kontaktName: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs">
                <span className="text-slate-500">E-Mail</span>
                <input
                  type="email"
                  value={form.kontaktEmail}
                  onChange={(e) => setForm((prev) => ({ ...prev, kontaktEmail: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs">
                <span className="text-slate-500">Telefon</span>
                <input
                  value={form.kontaktPhone}
                  onChange={(e) => setForm((prev) => ({ ...prev, kontaktPhone: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
            </div>
          </fieldset>

          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0c1929] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Stammdaten speichern
          </button>
        </div>
      )}

      {message ? (
        <p className="mt-3 text-xs text-emerald-700">{message}</p>
      ) : null}
      {error ? <p className="mt-3 text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
