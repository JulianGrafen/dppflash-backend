'use client';

import type { SupplierRequestView } from '@/app/dashboard/v2/lib/supplierRequestView';
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
  readonly field: SupplierRequestView | null;
  readonly bulkFields?: readonly SupplierRequestView[];
  readonly onClose: () => void;
  readonly onSend: () => void;
};

const BULK_FIELD_PREVIEW_LIMIT = 12;

export function SupplierOutreachDialog({
  open,
  draftId,
  field,
  bulkFields,
  onClose,
  onSend,
}: SupplierOutreachDialogProps) {
  const isBulk = Boolean(bulkFields && bulkFields.length > 0);
  if (!field && !isBulk) {
    return null;
  }

  const link = `https://dppflash-backend.onrender.com/supplier/outreach/demo-v2-${draftId}`;

  const supplier = isBulk
    ? 'Sammelanfrage (Demo)'
    : (field?.supplierHint ?? 'Lieferant');
  const email = isBulk
    ? 'compliance@supplier-eu.example'
    : (field?.supplierEmail ?? 'lieferant@example.com');

  const bulkCount = bulkFields?.length ?? 0;
  const bulkPreview = bulkFields?.slice(0, BULK_FIELD_PREVIEW_LIMIT).map((f) => `• ${f.label}`) ?? [];
  const bulkRemainder = bulkCount > BULK_FIELD_PREVIEW_LIMIT
    ? bulkCount - BULK_FIELD_PREVIEW_LIMIT
    : 0;
  const bulkFieldList = [
    ...bulkPreview,
    ...(bulkRemainder > 0 ? [`• … und ${bulkRemainder} weitere Pflichtfelder`] : []),
  ].join('\n');

  const subject = isBulk
    ? `DPP-Datenanfrage: ${bulkCount} Pflichtfelder (Produktpass)`
    : `DPP-Datenanfrage: ${field?.label}`;

  const intro = isBulk
    ? `Für ${bulkCount} Pflichtfelder fehlen noch Angaben. DPP-Flash hat eine konsolidierte Anfrage vorbereitet — Sie prüfen und senden.`
    : `Für ${field?.label} fehlen noch Angaben. DPP-Flash hat die Anfrage vorbereitet — Sie prüfen und senden.`;

  const body = isBulk
    ? `Guten Tag,\n\nfür unseren Produktpass benötigen wir noch Informationen zu folgenden Pflichtfeldern:\n\n${bulkFieldList}\n\nBitte ergänzen Sie die Daten über diesen Link:\n${link}\n\nVielen Dank,\nIhr Kunde über DPP-Flash`
    : `Guten Tag,\n\nfür unseren Produktpass benötigen wir noch Informationen zu: ${field?.label}.\n\nBitte ergänzen Sie die Daten über diesen Link:\n${link}\n\nVielen Dank,\nIhr Kunde über DPP-Flash`;

  const title = isBulk ? 'Sammelanfrage vorbereitet' : 'Lieferantenanfrage vorbereitet';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {isBulk ? intro : (
            <>
              Für <strong className="text-foreground">{field?.label}</strong> fehlen noch Angaben.
              DPP-Flash hat die Anfrage vorbereitet — Sie prüfen und senden.
            </>
          )}
        </p>
        <div className="space-y-3">
          <div>
            <Label htmlFor="outreach-to">Empfänger</Label>
            <Input id="outreach-to" value={`${supplier} <${email}>`} readOnly />
          </div>
          <div>
            <Label htmlFor="outreach-subject">Betreff</Label>
            <Input id="outreach-subject" value={subject} readOnly />
          </div>
          <div>
            <Label htmlFor="outreach-body">Nachricht</Label>
            <Textarea
              id="outreach-body"
              readOnly
              rows={isBulk ? 10 : 5}
              value={body}
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
