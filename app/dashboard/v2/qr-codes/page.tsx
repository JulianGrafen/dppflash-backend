'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import QRCodeDisplay from '@/app/components/QRCodeDisplay';
import { V2SectionShell } from '@/app/dashboard/v2/components/V2SectionShell';
import { loadAllDrafts } from '@/app/dashboard/v2/mock/storage';
import type { DraftPassport } from '@/app/dashboard/v2/mock/types';
import { Card, CardContent } from '@/components/ui/card';

export default function QrCodesPage() {
  const [published, setPublished] = useState<DraftPassport[]>([]);

  useEffect(() => {
    setPublished(loadAllDrafts().filter((d) => d.status === 'published'));
  }, []);

  return (
    <V2SectionShell
      title="QR-Codes"
      description="Veröffentlichte Produktpässe mit Scan-Link (Demo)."
    >
      {published.length === 0 ? (
        <Card className="border-slate-200/90 shadow-sm">
          <CardContent className="py-10 text-center text-sm text-slate-500">
            Noch keine veröffentlichten Pässe. Abschluss im Wizard unter „Veröffentlichen“.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {published.map((draft) => (
            <Card key={draft.id} className="border-slate-200/90 shadow-sm">
              <CardContent className="space-y-4 pt-6">
                <p className="font-semibold text-slate-900">{draft.productName}</p>
                <QRCodeDisplay
                  productId={draft.publishedPassId ?? 'battery-demo-public'}
                  productName={draft.productName}
                />
                <Link href="/p/battery-demo-public" className="text-sm text-primary underline">
                  Öffentlichen Pass öffnen
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </V2SectionShell>
  );
}
