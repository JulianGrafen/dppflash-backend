'use client';

import { useCallback, useEffect, useState } from 'react';
import { V2SectionShell } from '@/app/dashboard/v2/components/V2SectionShell';
import { SupplierOutreachDialog } from '@/app/dashboard/v2/components/SupplierOutreachDialog';
import { SupplierRequestDetailDialog } from '@/app/dashboard/v2/components/SupplierRequestDetailDialog';
import { SupplierRequestStatusBar } from '@/app/dashboard/v2/components/SupplierRequestStatusBar';
import { loadAllDrafts, patchDraftField } from '@/app/dashboard/v2/mock/storage';
import type { DraftField } from '@/app/dashboard/v2/mock/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from 'cn';

type SupplierRow = { draftId: string; productName: string; field: DraftField };

function loadSupplierRows(): SupplierRow[] {
  return loadAllDrafts().flatMap((d) =>
    d.fields
      .filter((f) => f.supplierHint || f.provenance === 'pending_supplier')
      .map((field) => ({ draftId: d.id, productName: d.productName, field })),
  );
}

export default function LieferantenPage() {
  const [rows, setRows] = useState<SupplierRow[]>([]);
  const [selected, setSelected] = useState<SupplierRow | null>(null);
  const [resendField, setResendField] = useState<SupplierRow | null>(null);

  const refresh = useCallback(() => {
    setRows(loadSupplierRows());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function handleResendConfirm() {
    if (!resendField) {
      return;
    }
    patchDraftField(resendField.draftId, resendField.field.path, {
      provenance: 'pending_supplier',
      supplierSentAt: new Date().toISOString(),
    });
    setResendField(null);
    setSelected(null);
    refresh();
  }

  return (
    <V2SectionShell
      title="Lieferanten"
      description="Offene Datenanfragen und vorgeschlagene Lieferantenkontakte."
    >
      <Card className="border-slate-200/90 shadow-sm">
        <CardContent className="divide-y divide-slate-100 p-0">
          {rows.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-slate-500">
              Keine Lieferantenanfragen — Lücken im Wizard mit „Lieferanten anfragen“ öffnen.
            </p>
          ) : (
            rows.map((row) => {
              const isActive =
                selected?.draftId === row.draftId && selected?.field.path === row.field.path;
              return (
                <div
                  key={`${row.draftId}-${row.field.path}`}
                  className={cn(
                    'flex items-start justify-between gap-4 px-6 py-4 transition-colors',
                    isActive && 'bg-slate-50',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">{row.field.supplierHint ?? 'Lieferant'}</p>
                    <p className="text-sm text-slate-600">
                      {row.productName} · {row.field.label}
                    </p>
                    <SupplierRequestStatusBar field={row.field} />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-0.5 shrink-0 cursor-pointer"
                    onClick={() => setSelected(row)}
                  >
                    Details
                  </Button>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <SupplierRequestDetailDialog
        open={selected !== null}
        productName={selected?.productName ?? ''}
        draftId={selected?.draftId ?? ''}
        field={selected?.field ?? null}
        onClose={() => setSelected(null)}
        onResend={() => {
          if (selected) {
            setResendField(selected);
          }
        }}
      />

      <SupplierOutreachDialog
        open={resendField !== null}
        draftId={resendField?.draftId ?? ''}
        field={resendField?.field ?? null}
        onClose={() => setResendField(null)}
        onSend={handleResendConfirm}
      />
    </V2SectionShell>
  );
}
