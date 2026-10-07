'use client';

import { Suspense } from 'react';
import { EditorContentLocaleProvider } from './EditorContentLocaleContext';
import { PassportEditorShell } from './PassportEditorShell';
import { PassportFieldForm } from './PassportFieldForm';
import { PassportReadinessRail } from './PassportReadinessRail';
import { editorStickyAside, v2GridShell, v2Panel } from '@/app/dashboard/v2/lib/surfaceClasses';
import { PassportSectionNav } from './PassportSectionNav';

function EditorBody() {
  return (
    <EditorContentLocaleProvider>
    <PassportEditorShell>
      <div
        className={`grid gap-0 ${v2GridShell} lg:grid-cols-[minmax(240px,280px)_1fr_minmax(260px,300px)]`}
      >
        <aside className={`border-r ${v2Panel} ${editorStickyAside}`}>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4">
            <PassportSectionNav />
          </div>
        </aside>

        <div className="min-w-0 space-y-4 p-4 lg:p-5">
          <div className={`rounded-xl border p-3 lg:hidden ${v2Panel}`}>
            <PassportSectionNav />
          </div>
          <PassportFieldForm />
        </div>

        <aside className={`border-l border-border ${editorStickyAside}`}>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
            <PassportReadinessRail layout="dock" />
          </div>
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
    <Suspense fallback={<p className="text-sm text-muted-foreground">Editor wird geladen…</p>}>
      <EditorBody />
    </Suspense>
  );
}
