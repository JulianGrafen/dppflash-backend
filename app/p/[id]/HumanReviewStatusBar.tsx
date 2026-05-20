'use client';

import { useState } from 'react';
import { CheckCircle2, ShieldAlert } from 'lucide-react';

export function HumanReviewStatusBar() {
  const [isVerified, setIsVerified] = useState(false);

  return (
    <div className="flex flex-col gap-3 bg-slate-50/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      {isVerified ? (
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-[12px] font-bold text-emerald-800 ring-1 ring-inset ring-emerald-200">
          <CheckCircle2 className="h-4 w-4" strokeWidth={2} aria-hidden />
          Verifiziert durch Human Review
        </span>
      ) : (
        <>
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-[12px] font-bold text-amber-900 ring-1 ring-inset ring-amber-200">
            <ShieldAlert className="h-4 w-4" strokeWidth={2} aria-hidden />
            Ausstehend — Human Review / Abnahme noch nicht abgeschlossen
          </span>
          <button
            type="button"
            onClick={() => setIsVerified(true)}
            className="inline-flex w-fit items-center justify-center rounded-lg bg-[#0c1929] px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
          >
            Daten validieren & freigeben
          </button>
        </>
      )}
    </div>
  );
}
