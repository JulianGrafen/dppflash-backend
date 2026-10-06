'use client';

import type { DraftField } from '@/app/dashboard/v2/mock/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type SupplierOutreachDialogProps = {
  readonly open: boolean;
  readonly draftId: string;
  readonly field: DraftField | null;
  readonly onClose: () => void;
  readonly onSend: () => void;
};

export function SupplierOutreachDialog({
  open,
  draftId,
  field,
  onClose,
  onSend,
}: SupplierOutreachDialogProps) {
  if (!field) {
    return null;
  }

  const supplier = field.supplierHint ?? 'Lieferant';
  const email = field.supplierEmail ?? 'lieferant@example.com';
  const link = `https://dppflash-backend.onrender.com/supplier/outreach/demo-v2-${draftId}`;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Lieferantenanfrage vorbereitet</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-600">
          Für <strong>{field.label}</strong> fehlen noch Angaben. DPP-Flash hat die Anfrage
          vorbereitet — Sie prüfen und senden.
        </p>
        <div className="space-y-3">
          <div>
            <Label htmlFor="outreach-to">Empfänger</Label>
            <Input id="outreach-to" value={`${supplier} <${email}>`} readOnly />
          </div>
          <div>
            <Label htmlFor="outreach-subject">Betreff</Label>
            <Input
              id="outreach-subject"
              value={`DPP-Datenanfrage: ${field.label}`}
              readOnly
            />
          </div>
          <div>
            <Label htmlFor="outreach-body">Nachricht</Label>
            <Textarea
              id="outreach-body"
              readOnly
              rows={5}
              value={`Guten Tag,\n\nfür unseren Produktpass benötigen wir noch Informationen zu: ${field.label}.\n\nBitte ergänzen Sie die Daten über diesen Link:\n${link}\n\nVielen Dank,\nIhr Kunde über DPP-Flash`}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} className="cursor-pointer">
            Abbrechen
          </Button>
          <Button type="button" onClick={onSend} className="cursor-pointer">
            Anfrage senden (Demo)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
