'use client';

import { useCallback, useEffect, useState } from 'react';
import { SupplierOutreachDialog } from '@/app/dashboard/v2/components/SupplierOutreachDialog';
import { SupplierRequestDetailDialog } from '@/app/dashboard/v2/components/SupplierRequestDetailDialog';
import { SupplierRequestStatusBar } from '@/app/dashboard/v2/components/SupplierRequestStatusBar';
import { loadSupplierRows, type SupplierRow } from '@/app/dashboard/v2/lib/loadSupplierRows';
import { patchDraftField, patchDraftPassportField } from '@/app/dashboard/v2/mock/storage';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EnterMotion, enterMotionDelay } from '@/components/ui/enter-motion';
import { cn } from 'cn';

export function LieferantenInboxPanel() {
  const [rows, setRows] = useState<SupplierRow[]>([]);
  const [selected, setSelected] = useState<SupplierRow | null>(null);
  const [resendRow, setResendRow] = useState<SupplierRow | null>(null);

  const refresh = useCallback(() => {
    setRows(loadSupplierRows());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function handleResendConfirm() {
    if (!resendRow) {
      return;
    }
    const sentAt = new Date().toISOString();
    if (resendRow.kind === 'passport') {
      patchDraftPassportField(resendRow.draftId, resendRow.view.path, {
        provenance: 'pending_supplier',
        supplierSentAt: sentAt,
      });
    } else {
      patchDraftField(resendRow.draftId, resendRow.view.path, {
        provenance: 'pending_supplier',
        supplierSentAt: sentAt,
      });
    }
    setResendRow(null);
    setSelected(null);
    refresh();
  }

  return (
    <>
      <EnterMotion>
        <Card variant="elevated" className="border-border">
          <CardContent className="divide-y divide-border p-0">
            {rows.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-muted-foreground">
                Keine Lieferantenanfragen. Im Editor bei Blockern „Lieferantenanfrage stellen“ oder im
                Wizard unter Lücken starten.
              </p>
            ) : (
              rows.map((row, index) => {
                const isActive =
                  selected?.draftId === row.draftId &&
                  selected?.view.path === row.view.path &&
                  selected?.kind === row.kind;
                return (
                  <EnterMotion
                    key={`${row.kind}-${row.draftId}-${row.view.path}`}
                    delayMs={enterMotionDelay(index, 40)}
                    className={cn(
                      'flex items-start justify-between gap-4 px-6 py-4 transition-colors duration-150',
                      isActive && 'bg-muted/40',
                    )}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="font-medium text-foreground">{row.view.supplierHint ?? 'Lieferant'}</p>
                      <p className="text-sm text-muted-foreground">
                        {row.productName} · {row.view.label}
                      </p>
                      <SupplierRequestStatusBar field={row.view} />
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
                  </EnterMotion>
                );
              })
            )}
          </CardContent>
        </Card>
      </EnterMotion>

      <SupplierRequestDetailDialog
        open={selected !== null}
        productName={selected?.productName ?? ''}
        draftId={selected?.draftId ?? ''}
        field={selected?.view ?? null}
        onClose={() => setSelected(null)}
        onResend={() => {
          if (selected) {
            setResendRow(selected);
          }
        }}
      />

      <SupplierOutreachDialog
        open={resendRow !== null}
        draftId={resendRow?.draftId ?? ''}
        field={resendRow?.view ?? null}
        onClose={() => setResendRow(null)}
        onSend={handleResendConfirm}
      />
    </>
  );
}
