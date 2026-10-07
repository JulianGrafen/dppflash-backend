'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AlertTriangle, Eye } from 'lucide-react';
import { useDraft } from '@/app/dashboard/v2/context/DraftProvider';
import { BatteryPassPreviewFromDraft } from '@/components/dpp/battery-pass-preview-from-draft';
import { VOLTSTRIDE_720_ID } from '@/app/fixtures/voltstride720PublicPassport';
import { LinkButton } from '@/app/dashboard/v2/components/LinkButton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatSkuEanSubtitle } from '@/app/dashboard/v2/mock/draftProductIdentifiers';
import { EditorLocaleSwitcher } from './EditorContentLocaleContext';
import { PublishDistributionDialog } from '@/app/dashboard/v2/components/PublishDistributionDialog';
import { PassportEditorProductImage } from './PassportEditorProductImage';

type PassportEditorShellProps = {
  readonly children: React.ReactNode;
};

export function PassportEditorShell({ children }: PassportEditorShellProps) {
  const { draft, passportSummary, syncPreview } = useDraft();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRevision, setPreviewRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [publishFeedback, setPublishFeedback] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const passId = draft?.publishedPassId ?? VOLTSTRIDE_720_ID;

  async function openPreview() {
    setBusy(true);
    const publicUrl = await syncPreview();
    setBusy(false);
    if (!publicUrl) {
      return;
    }
    setPreviewRevision((n) => n + 1);
    setPreviewOpen(true);
  }

  function openPublishDialog() {
    setPublishFeedback(null);
    setPublishOpen(true);
  }

  if (!draft) {
    return <p className="text-sm text-muted-foreground">Entwurf wird geladen…</p>;
  }

  const statusLabel = draft.status === 'published' ? 'Veröffentlicht' : 'Entwurf';

  return (
    <div className="-mx-2 min-h-[calc(100vh-6rem)] sm:-mx-4">
      <header className="mb-4 flex flex-col gap-4 border-b border-border bg-card px-4 py-4 text-card-foreground sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <PassportEditorProductImage passId={passId} productName={draft.productName} />
          <div className="min-w-0 space-y-2">
          <nav className="text-xs text-muted-foreground" aria-label="Breadcrumb">
            <Link href="/dashboard/v2/produktpaesse" className="hover:text-foreground">
              Workspace
            </Link>
            <span className="mx-1.5">›</span>
            <span className="text-foreground/80">Produktpässe</span>
          </nav>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">{draft.productName}</h1>
            <Badge variant="outline" className="gap-1 font-normal">
              {statusLabel}
              {!passportSummary.criticalOk ? (
                <AlertTriangle className="h-3 w-3 text-amber-600" aria-hidden />
              ) : null}
            </Badge>
          </div>
          <p
            className="text-sm text-muted-foreground tabular-nums"
            aria-label="Produktkennungen"
          >
            {formatSkuEanSubtitle(draft)}
          </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <EditorLocaleSwitcher />
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer gap-2"
            disabled={busy}
            onClick={() => void openPreview()}
          >
            <Eye className="h-4 w-4" aria-hidden />
            Preview
          </Button>
          <Button
            type="button"
            className="cursor-pointer"
            disabled={busy || !passportSummary.criticalOk}
            onClick={openPublishDialog}
          >
            {draft.status === 'published' ? 'Erneut veröffentlichen' : 'Publish'}
          </Button>
        </div>
      </header>
      {publishFeedback ? (
        <p
          className={`mx-4 mb-2 text-sm sm:mx-6 ${publishFeedback.startsWith('Veröffentlicht') ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}
          role="status"
        >
          {publishFeedback}
        </p>
      ) : null}

      <div className="px-2 sm:px-4">{children}</div>

      <PublishDistributionDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        draft={draft}
        criticalOk={passportSummary.criticalOk}
        onPublished={(url) => {
          setPublishFeedback(`Veröffentlicht — öffentlicher Pass: ${url}`);
        }}
      />

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent
          showCloseButton
          className="fixed top-1/2 left-1/2 z-50 flex h-[min(844px,calc(100dvh-2.5rem))] w-[min(390px,calc(100vw-1.5rem))] max-w-none -translate-x-1/2 -translate-y-1/2 flex-col gap-0 overflow-hidden rounded-[2rem] border-[10px] border-slate-900 bg-slate-900 p-0 shadow-2xl ring-0 sm:max-w-none"
          aria-describedby={undefined}
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.35rem] bg-[#eef1f6]">
            <DialogHeader className="shrink-0 gap-1 border-b border-slate-200/90 bg-white px-3 py-2.5">
              <div className="flex items-center justify-between gap-2 pr-8">
                <DialogTitle className="text-sm font-semibold text-[#0c1929]">Preview</DialogTitle>
                <LinkButton
                  href={`/p/${passId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 px-2 text-xs"
                >
                  Vollbild
                </LinkButton>
              </div>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {previewRevision > 0 && draft.passportFields ? (
                <div key={previewRevision}>
                  <BatteryPassPreviewFromDraft
                    passportFields={draft.passportFields}
                    productName={draft.productName}
                    passId={passId}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
