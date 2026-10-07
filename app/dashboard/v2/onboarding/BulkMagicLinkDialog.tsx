'use client';

import { CATALOG_SUMMARY, gapStatusLabels } from './globalCatalogMock';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type BulkMagicLinkDialogProps = {
  open: boolean;
  onClose: () => void;
  onSend: () => void;
};

export function BulkMagicLinkDialog({ open, onClose, onSend }: BulkMagicLinkDialogProps) {
  const gaps = gapStatusLabels();
  const body = `Dear Supplier Partners,

DPP-Flash has identified compliance gaps across ${CATALOG_SUMMARY.gapsIdentified.toLocaleString('de-DE')} SKUs in our global catalog.

Please complete the missing data via your secure Magic Link (one request per SKU batch):

${gaps.map((g) => `• ${g}`).join('\n')}

Typical attachments requested: UN 38.3 test reports, recycled content declarations, carbon footprint studies.

Thank you,
Your customer via DPP-Flash`;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk Magic Link: Lieferantenanfragen</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-600">
          Simulated campaign to{' '}
          <strong>supplier@shenzhen-battery.com</strong>,{' '}
          <strong>compliance@supplier-eu.example</strong> and{' '}
          <strong>{CATALOG_SUMMARY.gapsIdentified.toLocaleString('de-DE')} SKU batches</strong>.
        </p>
        <div className="space-y-2">
          <Label>Betreff</Label>
          <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            DPP-Flash: fehlende Compliance-Daten ({CATALOG_SUMMARY.gapsIdentified} SKUs)
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="bulk-body">Nachricht (Vorschau)</Label>
          <Textarea id="bulk-body" readOnly rows={12} value={body} className="font-mono text-xs" />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="cursor-pointer" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="button" className="cursor-pointer" onClick={onSend}>
            Send Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
