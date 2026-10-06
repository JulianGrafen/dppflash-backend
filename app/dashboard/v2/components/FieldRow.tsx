'use client';

import { fieldNeedsReview } from '@/app/dashboard/v2/mock/completeness';
import type { DraftField } from '@/app/dashboard/v2/mock/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type FieldRowProps = {
  readonly field: DraftField;
  readonly onConfirm: () => void;
  readonly onChange: (value: string) => void;
};

function statusBadge(field: DraftField) {
  if (field.provenance === 'missing') {
    return <Badge variant="destructive">Fehlt</Badge>;
  }
  if (field.provenance === 'pending_supplier') {
    return <Badge variant="secondary">Lieferant angefragt</Badge>;
  }
  if (field.provenance === 'confirmed') {
    return <Badge className="bg-emerald-100 text-emerald-900 hover:bg-emerald-100">Bestätigt</Badge>;
  }
  if (fieldNeedsReview(field)) {
    return <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">Prüfen</Badge>;
  }
  return <Badge variant="outline">KI erkannt</Badge>;
}

export function FieldRow({ field, onConfirm, onChange }: FieldRowProps) {
  return (
    <div
      id={`field-${field.path}`}
      className="scroll-mt-24 border-b border-dashed border-slate-200 py-3 last:border-0"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-700">{field.label}</span>
        {statusBadge(field)}
      </div>
      {field.provenance === 'missing' ? (
        <p className="text-sm text-slate-500">Noch nicht vorhanden — bitte ergänzen oder Lieferant anfragen.</p>
      ) : (
        <Input
          value={field.value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="mb-2"
        />
      )}
      {field.provenance !== 'missing' && field.provenance !== 'confirmed' ? (
        <Button type="button" size="sm" variant="outline" onClick={onConfirm} className="cursor-pointer">
          Bestätigen
        </Button>
      ) : null}
    </div>
  );
}
