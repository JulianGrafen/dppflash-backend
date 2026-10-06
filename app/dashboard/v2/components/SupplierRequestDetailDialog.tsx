'use client';

import type { DraftField } from '@/app/dashboard/v2/mock/types';
import { SupplierRequestStatusBar } from '@/app/dashboard/v2/components/SupplierRequestStatusBar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

function formatSupplierSentAt(iso?: string): string {
  if (!iso) {
    return 'Noch nicht gesendet';
  }
  try {
    return new Date(iso).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

type SupplierRequestDetailDialogProps = {
  readonly open: boolean;
  readonly productName: string;
  readonly draftId: string;
  readonly field: DraftField | null;
  readonly onClose: () => void;
  readonly onResend: () => void;
};

export function SupplierRequestDetailDialog({
  open,
  productName,
  draftId,
  field,
  onClose,
  onResend,
}: SupplierRequestDetailDialogProps) {
  if (!field) {
    return null;
  }

  const supplierName = field.supplierHint ?? 'Lieferant';
  const email = field.supplierEmail ?? '—';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{supplierName}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-600">
          {productName} · <span className="font-medium text-slate-800">{field.label}</span>
        </p>

        <SupplierRequestStatusBar field={field} className="max-w-none" />

        <dl className="mt-4 space-y-3 rounded-lg border border-slate-100 bg-slate-50/80 px-4 py-3 text-sm">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Lieferanten-E-Mail
            </dt>
            <dd className="mt-0.5 font-mono text-slate-900 break-all">{email}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Gesendet am
            </dt>
            <dd className="mt-0.5 text-slate-900">{formatSupplierSentAt(field.supplierSentAt)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Anfrage-ID (Demo)
            </dt>
            <dd className="mt-0.5 font-mono text-xs text-slate-600">
              {draftId} · {field.path}
            </dd>
          </div>
        </dl>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose} className="cursor-pointer">
            Schließen
          </Button>
          <Button type="button" onClick={onResend} className="cursor-pointer">
            Nochmal senden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
