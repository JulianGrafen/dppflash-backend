'use client';

import { Suspense } from 'react';
import { EditorContentLocaleProvider } from './EditorContentLocaleContext';
import { PassportEditorShell } from './PassportEditorShell';
import { PassportFieldForm } from './PassportFieldForm';
import { PassportReadinessRail } from './PassportReadinessRail';
import { PassportSectionNav } from './PassportSectionNav';

function EditorBody() {
  return (
    <EditorContentLocaleProvider>
    <PassportEditorShell>
      <div className="grid gap-0 rounded-xl border border-slate-200/90 bg-[#f4f5f7] lg:grid-cols-[minmax(240px,280px)_1fr_minmax(260px,300px)]">
        <aside
          className="hidden border-r border-slate-200/90 bg-white lg:sticky lg:top-4 lg:block lg:max-h-[calc(100vh-11rem)] lg:self-start lg:overflow-y-auto"
        >
          <PassportSectionNav />
        </aside>

        <div className="min-w-0 space-y-4 p-4 lg:p-5">
          <div className="rounded-xl border border-slate-200/90 bg-white p-3 lg:hidden">
            <PassportSectionNav />
          </div>
          <PassportFieldForm />
        </div>

        <aside
          className="hidden border-l border-slate-200/90 p-4 lg:sticky lg:top-4 lg:block lg:max-h-[calc(100vh-11rem)] lg:self-start lg:overflow-y-auto"
        >
          <PassportReadinessRail />
        </aside>
      </div>

      <div className="mt-4 lg:hidden">
        <PassportReadinessRail />
      </div>
    </PassportEditorShell>
    </EditorContentLocaleProvider>
  );
}

export default function PassportEditorPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Editor wird geladen…</p>}>
      <EditorBody />
    </Suspense>
  );
}
